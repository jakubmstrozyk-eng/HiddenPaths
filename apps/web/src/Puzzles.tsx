import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RIDDLES, type Outcome } from '@hp/content';
import {
  claimHolds, digResult, lockHint, trapWalk,
  type ChestClaim, type ChestContent, type PlayerState, type PuzzleAnswer, type PuzzleData, type PuzzleState,
} from '@hp/engine';
import { DieFace, diceStyle } from './DiceFace';
import { puzzleSound } from './Feedback';
import { outcomeText } from './outcomeText';
import { useT } from './i18n';

/**
 * The mini-games on event cards. Each one plays on the card itself and ends by sending its answer
 * once; the engine checks it and plays the card's result.
 */

type Done = (answer: PuzzleAnswer) => void;
interface Props<K extends PuzzleData['kind']> {
  data: Extract<PuzzleData, { kind: K }>;
  state: PuzzleState;
  me: PlayerState;
  done: Done;
}

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const shuffled = <T,>(items: T[]) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Counts down while `running`; calls `onEnd` once at zero. Returns the share of time left. */
function useCountdown(seconds: number, running: boolean, onEnd: () => void, resetKey: unknown = 0) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => setLeft(seconds), [seconds, resetKey]);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const from = left;
    const id = setInterval(() => {
      const now = Math.max(0, from - (Date.now() - started) / 1000);
      setLeft(now);
      if (now <= 0) {
        clearInterval(id);
        end.current();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, resetKey]);
  return { left, share: left / seconds };
}

function Hourglass({ share, left }: { share: number; left: number }) {
  return (
    <div className={`pz-time ${share < 0.25 ? 'low' : ''}`} role="timer" aria-label={`${Math.ceil(left)} s`}>
      <span style={{ width: `${Math.max(0, share) * 100}%` }} />
      <b>{Math.ceil(left)} s</b>
    </div>
  );
}

/** Sends the answer once, after a short pause so the player sees how it went. */
function useFinish(done: Done) {
  const sent = useRef(false);
  return useCallback((answer: PuzzleAnswer, delay = 900) => {
    if (sent.current) return;
    sent.current = true;
    setTimeout(() => done(answer), reduced() ? 200 : delay);
  }, [done]);
}

function HelperNote({ state, yes, no }: { state: PuzzleState; yes: string; no: string }) {
  if (state.helped === null) return null;
  return <p className={`pz-helper ${state.helped ? 'ok' : ''}`}>{state.helped ? `✦ ${yes}` : no}</p>;
}

// ---------- Riddle ----------

function Riddle({ data, state, done }: Props<'riddle'>) {
  const { tx, locale } = useT();
  const pl = locale === 'pl';
  const riddle = RIDDLES[data.riddle]!;
  const answer = tx(riddle.answer);
  const p = state.puzzle.kind === 'riddle' ? state.puzzle : null;
  // Scattered once, when the satyr starts: a fresh order on every tick would make the tiles jump.
  const [tiles] = useState(() => shuffled([...answer, ...tx(data.decoys)].map((ch, i) => ({ ch, i }))));
  const firstTile = tiles.find((t) => t.i === 0)!;
  const [slots, setSlots] = useState<(number | null)[]>(() => [...answer].map((_, i) => (i === 0 && state.helped ? firstTile.i : null)));
  const [verdict, setVerdict] = useState<null | boolean>(null);
  const started = useRef(Date.now());
  const finish = useFinish(done);
  const word = slots.map((s) => (s === null ? '' : tiles.find((t) => t.i === s)!.ch)).join('');
  const submit = () => {
    if (verdict !== null) return;
    const ok = word.toUpperCase() === answer.toUpperCase();
    setVerdict(ok);
    puzzleSound(ok ? 'win' : 'wrong');
    finish({ word, fast: (Date.now() - started.current) / 1000 <= (p?.fastSeconds ?? 0) }, 1300);
  };
  const time = useCountdown(p?.seconds ?? 45, verdict === null, submit);
  const used = new Set(slots.filter((s): s is number => s !== null));
  const place = (tile: number) => {
    if (verdict !== null) return;
    const at = slots.indexOf(null);
    if (at < 0) return;
    puzzleSound('tick');
    setSlots(slots.map((s, i) => (i === at ? tile : s)));
  };
  const take = (slot: number) => {
    if (verdict !== null || (slot === 0 && state.helped)) return;
    setSlots(slots.map((s, i) => (i === slot ? null : s)));
  };
  return (
    <div className="pz pz-riddle">
      <blockquote className="pz-verse">„{tx(riddle.question)}”</blockquote>
      <HelperNote state={state} yes={pl ? 'Inteligencja: satyr zdradza pierwszą literę.' : 'Intelligence: the satyr gives away the first letter.'} no={pl ? 'Satyr nie zdradza żadnej litery.' : 'The satyr gives nothing away.'} />
      <Hourglass {...time} />
      <div className={`pz-slots ${verdict === true ? 'right' : verdict === false ? 'wrong' : ''}`}>
        {slots.map((s, i) => (
          <button key={i} className={`pz-slot ${s !== null ? 'full' : ''} ${i === 0 && state.helped ? 'given' : ''}`} onClick={() => take(i)} aria-label={s === null ? (pl ? 'puste pole' : 'empty box') : tiles.find((t) => t.i === s)!.ch}>
            {s === null ? '' : tiles.find((t) => t.i === s)!.ch}
          </button>
        ))}
      </div>
      <div className="pz-tiles">
        {tiles.map((t) => (
          <motion.button key={t.i} className="pz-tile" disabled={used.has(t.i) || verdict !== null} onClick={() => place(t.i)} whileTap={{ scale: 0.9 }}>{t.ch}</motion.button>
        ))}
      </div>
      {verdict === null ? (
        <button className="pz-go" disabled={slots.includes(null)} onClick={submit}>{pl ? 'Odpowiadam' : 'Answer'}</button>
      ) : (
        <p className={`pz-verdict ${verdict ? 'ok' : ''}`}>{verdict ? (pl ? 'Satyr klaszcze w kopytka!' : 'The satyr claps his hooves!') : `${pl ? 'Satyr chichocze. Odpowiedź: ' : 'The satyr giggles. The answer: '}${answer}`}</p>
      )}
    </div>
  );
}

// ---------- Quiz ----------

function Quiz({ data, state, done }: Props<'quiz'>) {
  const { tx, locale } = useT();
  const pl = locale === 'pl';
  const seconds = state.puzzle.kind === 'quiz' ? state.puzzle.seconds : 15;
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const finish = useFinish(done);
  const q = data.questions[at];
  const choose = (i: number | null) => {
    if (picked !== undefined || !q) return;
    setPicked(i);
    puzzleSound(i === q.correct ? 'right' : 'wrong');
    const next = [...answers, i];
    setTimeout(() => {
      setAnswers(next);
      setPicked(undefined);
      if (at + 1 >= data.questions.length) finish({ answers: next }, 300);
      else setAt(at + 1);
    }, reduced() ? 300 : 1100);
  };
  const time = useCountdown(seconds, picked === undefined && !!q, () => choose(null), at);
  const right = answers.filter((a, i) => a === data.questions[i]!.correct).length + (picked !== undefined && picked === q?.correct ? 1 : 0);
  if (!q) return null;
  return (
    <div className="pz pz-quiz">
      <div className="pz-eyes" aria-label={pl ? `Dobre odpowiedzi: ${right}` : `Right answers: ${right}`}>
        {data.questions.map((_, i) => <span key={i} className={i < right ? 'lit' : ''} />)}
      </div>
      <HelperNote state={state} yes={pl ? 'Inteligencja: jedna błędna odpowiedź jest od razu skreślona.' : 'Intelligence: one wrong answer is struck out each time.'} no={pl ? 'Musisz polegać na samej pamięci.' : 'You must rely on memory alone.'} />
      <Hourglass {...time} />
      <AnimatePresence mode="wait">
        <motion.div key={at} className="pz-question" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
          <small>{pl ? `Pytanie ${at + 1} z ${data.questions.length}` : `Question ${at + 1} of ${data.questions.length}`}</small>
          <h3>{tx(q.question)}</h3>
          <div className="pz-answers">
            {q.options.map((o, i) => {
              const struck = state.helped && data.struck[at] === i;
              const shown = picked !== undefined;
              return (
                <button key={i} disabled={!!struck || shown} onClick={() => choose(i)}
                  className={`pz-answer ${struck ? 'struck' : ''} ${shown && i === q.correct ? 'right' : ''} ${shown && picked === i && i !== q.correct ? 'wrong' : ''}`}>
                  {tx(o)}
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------- Three cards ----------

function QueenCard({ face }: { face: boolean }) {
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      {face ? (
        <>
          <rect x="1" y="1" width="58" height="82" rx="5" fill="#fff6e0" stroke="#1a120c" strokeWidth="2" />
          <path d="M18 34 L22 22 L30 30 L38 22 L42 34 Z" fill="#e0b25c" stroke="#1a120c" strokeWidth="1.5" />
          <circle cx="30" cy="44" r="9" fill="#f2c9a0" stroke="#1a120c" strokeWidth="1.5" />
          <path d="M20 70 Q30 52 40 70 Z" fill="#c84a3a" stroke="#1a120c" strokeWidth="1.5" />
          <text x="8" y="16" fontSize="11" fontWeight="800" fill="#c84a3a">Q</text>
        </>
      ) : (
        <>
          <rect x="1" y="1" width="58" height="82" rx="5" fill="#2a1d4d" stroke="#e0b25c" strokeWidth="2" />
          <path d="M30 18 L44 42 L30 66 L16 42 Z" fill="none" stroke="#e0b25c" strokeWidth="2" />
          <circle cx="30" cy="42" r="5" fill="#e0b25c" />
        </>
      )}
    </svg>
  );
}

function BlankCard() {
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="1" y="1" width="58" height="82" rx="5" fill="#fff6e0" stroke="#1a120c" strokeWidth="2" />
      <path d="M30 26 L38 42 L30 58 L22 42 Z" fill="#3a3a48" />
      <text x="8" y="16" fontSize="11" fontWeight="800" fill="#3a3a48">7</text>
    </svg>
  );
}

function Cups({ data, state, done }: Props<'cups'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  // slotOf[card]: where each of the three cards lies; the queen is the card that started on `start`.
  const [slotOf, setSlotOf] = useState([0, 1, 2]);
  const [phase, setPhase] = useState<'show' | 'shuffle' | 'pick' | 'reveal'>('show');
  const [swap, setSwap] = useState(-1);
  const [pick, setPick] = useState<number | null>(null);
  const finish = useFinish(done);
  const speed = reduced() ? 250 : state.helped ? 720 : 430;
  useEffect(() => {
    if (phase === 'show') {
      const id = setTimeout(() => setPhase('shuffle'), 1600);
      return () => clearTimeout(id);
    }
    if (phase !== 'shuffle') return;
    if (swap >= data.swaps.length - 1) {
      const id = setTimeout(() => setPhase('pick'), speed);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      const [a, b] = data.swaps[swap + 1]!;
      setSlotOf((s) => s.map((slot) => (slot === a ? b : slot === b ? a : slot)));
      setSwap(swap + 1);
      puzzleSound('tick');
    }, swap < 0 ? 500 : speed);
    return () => clearTimeout(id);
  }, [phase, swap, data.swaps, speed]);
  const queen = data.start;
  const choose = (slot: number) => {
    if (phase !== 'pick') return;
    setPick(slot);
    setPhase('reveal');
    const ok = slotOf[queen] === slot;
    puzzleSound(ok ? 'win' : 'wrong');
    finish({ pick: slot }, 1500);
  };
  const lastSwap = data.swaps[swap];
  return (
    <div className="pz pz-cups">
      <HelperNote state={state} yes={pl ? 'Zręczność: Twoje oko nadąża za rękami Myrmida.' : 'Dexterity: your eye keeps up with the Myrmid\'s hands.'} no={pl ? 'Myrmid tasuje szybko.' : 'The Myrmid shuffles fast.'} />
      <p className="pz-hint">
        {phase === 'show' ? (pl ? 'Zapamiętaj Królową…' : 'Mark the Queen…') : phase === 'shuffle' ? (pl ? `Tasowanie… ${swap + 1}/${data.swaps.length}` : `Shuffling… ${swap + 1}/${data.swaps.length}`) : phase === 'pick' ? (pl ? 'Gdzie jest Królowa?' : 'Where is the Queen?') : pick !== null && slotOf[queen] === pick ? (pl ? 'Trafiłeś! Myrmid ze złością oddaje monetę.' : 'Got her! The Myrmid grudgingly hands over the coin.') : (pl ? 'Pudło. Myrmid zgarnia stawkę.' : 'Wrong. The Myrmid takes the stake.')}
      </p>
      <div className="pz-table">
        {[0, 1, 2].map((card) => {
          const moving = phase === 'shuffle' && lastSwap && (lastSwap[0] === slotOf[card] || lastSwap[1] === slotOf[card]);
          const up = moving && lastSwap![0] === slotOf[card];
          return (
            <motion.button
              key={card}
              className={`pz-card ${phase === 'pick' ? 'pickable' : ''} ${phase === 'reveal' && pick === slotOf[card] ? 'picked' : ''}`}
              style={{ left: `${slotOf[card]! * 34}%` }}
              animate={{ left: `${slotOf[card]! * 34}%`, y: moving ? [0, up ? -22 : 14, 0] : 0 }}
              transition={{ duration: speed / 1000, ease: 'easeInOut' }}
              onClick={() => choose(slotOf[card]!)}
              disabled={phase !== 'pick'}
              aria-label={pl ? `Karta ${slotOf[card]! + 1}` : `Card ${slotOf[card]! + 1}`}
            >
              {phase === 'show' || phase === 'reveal' ? (card === queen ? <QueenCard face /> : <BlankCard />) : <QueenCard face={false} />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Forge and climb: strike in the zone ----------

function Timing({ data, state, done }: Props<'forge' | 'climb'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const climb = data.kind === 'climb';
  const strikes = data.zones.length;
  const [strike, setStrike] = useState(0);
  const [hits, setHits] = useState<boolean[]>([]);
  const [flash, setFlash] = useState<null | boolean>(null);
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const finish = useFinish(done);
  const running = strike < strikes && flash === null;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const t0 = performance.now();
    const speed = (reduced() ? 0.35 : 0.55) + strike * 0.12;
    const tick = (now: number) => {
      const t = ((now - t0) / 1000) * speed;
      const p = 1 - Math.abs(((t % 2) + 2) % 2 - 1); // 0 → 1 → 0
      posRef.current = p;
      setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, strike]);
  const hit = useCallback(() => {
    if (!running) return;
    const ok = Math.abs(posRef.current - data.zones[strike]!) <= data.width / 2;
    puzzleSound(ok ? 'clang' : 'wrong');
    setFlash(ok);
    const next = [...hits, ok];
    setHits(next);
    setTimeout(() => {
      setFlash(null);
      setStrike(strike + 1);
      if (strike + 1 >= strikes) finish({ hits: next.filter(Boolean).length }, 500);
    }, reduced() ? 250 : 650);
  }, [running, data, strike, hits, strikes, finish]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hit(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [hit]);
  const zone = data.zones[Math.min(strike, strikes - 1)]!;
  return (
    <div className={`pz pz-timing ${climb ? 'climb' : 'forge'}`}>
      <HelperNote state={state}
        yes={climb ? (pl ? 'Zręczność: pewniejsze chwyty, szersza strefa.' : 'Dexterity: surer holds, a wider zone.') : (pl ? 'Siła: mocne ramię, szersza strefa.' : 'Strength: a strong arm, a wider zone.')}
        no={pl ? 'Strefa jest wąska, celuj dokładnie.' : 'The zone is narrow: aim well.'} />
      <p className="pz-hint">{climb ? (pl ? 'Łap gałąź, gdy znacznik jest w jasnej strefie.' : 'Grab the branch while the marker is in the bright zone.') : (pl ? 'Uderz, gdy znacznik przelatuje przez rozżarzoną stal.' : 'Strike while the marker crosses the glowing steel.')}</p>
      <div className={`pz-bar ${flash === true ? 'hit' : flash === false ? 'miss' : ''}`} onPointerDown={hit}>
        <span className="pz-zone" style={{ left: `${(zone - data.width / 2) * 100}%`, width: `${data.width * 100}%` }} />
        <span className="pz-marker" style={{ left: `${pos * 100}%` }} />
        {flash !== null && <motion.span className="pz-spark" initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }} style={{ left: `${pos * 100}%` }}>{flash ? '✦' : '✕'}</motion.span>}
      </div>
      <div className="pz-strikes">
        {Array.from({ length: strikes }, (_, i) => <span key={i} className={hits[i] === true ? 'ok' : hits[i] === false ? 'no' : i === strike ? 'now' : ''}>{climb ? '▲' : '⚒'}</span>)}
      </div>
      <button className="pz-go" onClick={hit} disabled={!running}>{climb ? (pl ? 'Chwyt!' : 'Grab!') : (pl ? 'Uderz!' : 'Strike!')}</button>
    </div>
  );
}

// ---------- Chests ----------

const SIDE_PL = ['lewa', 'środkowa', 'prawa'];
const SIDE_IN_PL = ['lewej', 'środkowej', 'prawej'];
const SIDE_EN = ['the left one', 'the middle one', 'the right one'];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function claimText(c: ChestClaim, pl: boolean): string {
  if (c.about === 'here') return pl ? (c.treasure ? 'Skarb jest tutaj.' : 'Skarbu tu nie ma.') : (c.treasure ? 'The treasure is here.' : 'The treasure is not here.');
  const j = c.chest;
  if (pl) {
    if (c.is === 'treasure') return c.not ? `Skarbu nie ma w ${SIDE_IN_PL[j]}.` : `Skarb jest w ${SIDE_IN_PL[j]}.`;
    if (c.is === 'empty') return `${cap(SIDE_PL[j]!)} ${c.not ? 'nie jest pusta' : 'jest pusta'}.`;
    return `${cap(SIDE_PL[j]!)} ${c.not ? 'nie wybucha' : 'wybucha'}.`;
  }
  if (c.is === 'treasure') return c.not ? `The treasure is not in ${SIDE_EN[j]}.` : `The treasure is in ${SIDE_EN[j]}.`;
  if (c.is === 'empty') return `${cap(SIDE_EN[j]!)} is ${c.not ? 'not ' : ''}empty.`;
  return `${cap(SIDE_EN[j]!)} ${c.not ? 'does not explode' : 'explodes'}.`;
}

function ChestArt({ open, content }: { open: boolean; content?: ChestContent }) {
  return (
    <svg viewBox="0 0 64 52" aria-hidden="true">
      <rect x="6" y="22" width="52" height="26" fill="#7a4a24" stroke="#1a120c" strokeWidth="2" />
      <rect x="6" y="30" width="52" height="4" fill="#c8a060" />
      {open ? (
        <>
          <path d="M6 22 L14 4 L66 4 L58 22 Z" fill="#5a3418" stroke="#1a120c" strokeWidth="2" />
          {content === 'treasure' && <><circle cx="24" cy="22" r="5" fill="#ffd34d" stroke="#8a5a00" /><circle cx="34" cy="20" r="5" fill="#ffd34d" stroke="#8a5a00" /><circle cx="42" cy="23" r="4" fill="#7ee2ff" stroke="#1a5070" /></>}
          {content === 'blast' && <path d="M32 2 L36 14 L48 8 L40 20 L54 22 L40 26 L32 18 L24 26 L10 22 L24 20 L16 8 L28 14 Z" fill="#ff8a3a" stroke="#c8301a" />}
        </>
      ) : (
        <path d="M6 22 Q32 2 58 22 Z" fill="#8a5a30" stroke="#1a120c" strokeWidth="2" />
      )}
      <rect x="28" y="26" width="8" height="10" fill="#e0b25c" stroke="#1a120c" strokeWidth="1.5" />
    </svg>
  );
}

function Chests({ data, state, done }: Props<'chests'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [pick, setPick] = useState<number | null>(null);
  const finish = useFinish(done);
  const blastAt = data.contents.indexOf('blast');
  const choose = (i: number) => {
    if (pick !== null) return;
    setPick(i);
    const got = data.contents[i];
    puzzleSound(got === 'treasure' ? 'win' : got === 'blast' ? 'boom' : 'wrong');
    finish({ pick: i }, 1800);
  };
  return (
    <div className="pz pz-chests">
      <p className="pz-hint">{pl ? 'Dokładnie jeden napis mówi prawdę. Która skrzynia kryje skarb?' : 'Exactly one inscription tells the truth. Which chest holds the treasure?'}</p>
      <HelperNote state={state} yes={pl ? 'Inteligencja: słyszysz ciche tykanie w jednej ze skrzyń.' : 'Intelligence: you hear a faint ticking in one chest.'} no={pl ? 'Skrzynie milczą.' : 'The chests are silent.'} />
      <div className="pz-chest-row">
        {data.claims.map((c, i) => (
          <motion.button key={i} className={`pz-chest ${pick === i ? 'picked' : ''}`} disabled={pick !== null} onClick={() => choose(i)} whileHover={{ y: -4 }}>
            <span className="pz-chest-art">
              <ChestArt open={pick !== null} content={pick !== null ? data.contents[i] : undefined} />
              {state.helped && i === blastAt && pick === null && <span className="pz-tick">tik… tik…</span>}
            </span>
            <span className={`pz-inscription ${pick !== null ? (claimHolds(c, i, data.contents) ? 'true' : 'false') : ''}`}>{claimText(c, pl)}</span>
            <small>{pl ? cap(SIDE_PL[i]!) : ['Left', 'Middle', 'Right'][i]}</small>
          </motion.button>
        ))}
      </div>
      {pick !== null && (
        <p className={`pz-verdict ${data.contents[pick] === 'treasure' ? 'ok' : ''}`}>
          {data.contents[pick] === 'treasure' ? (pl ? 'Skarb!' : 'Treasure!') : data.contents[pick] === 'blast' ? (pl ? 'Bum! Skrzynia wybucha.' : 'Boom! The chest explodes.') : (pl ? 'Pusto. Pozostałe skrzynie znikają.' : 'Empty. The other chests vanish.')}
        </p>
      )}
    </div>
  );
}

// ---------- Traps ----------

function Traps({ data, state, done }: Props<'traps'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const { size } = data;
  const [phase, setPhase] = useState<'ready' | 'flash' | 'walk' | 'end'>('ready');
  const [path, setPath] = useState<number[]>([]);
  const finish = useFinish(done);
  useEffect(() => {
    if (phase === 'ready') {
      const id = setTimeout(() => setPhase('flash'), 700);
      return () => clearTimeout(id);
    }
    if (phase === 'flash') {
      const id = setTimeout(() => setPhase('walk'), data.flashMs);
      return () => clearTimeout(id);
    }
  }, [phase, data.flashMs]);
  const walk = trapWalk(data, path);
  const step = (cell: number) => {
    if (phase !== 'walk' || path.includes(cell)) return;
    const next = [...path, cell];
    const res = trapWalk(data, next);
    const last = path[path.length - 1];
    const valid = last === undefined ? cell >= (size - 1) * size : Math.abs((last % size) - (cell % size)) + Math.abs(Math.floor(last / size) - Math.floor(cell / size)) === 1;
    if (!valid) return;
    setPath(next);
    if (res.trap !== null) {
      puzzleSound('boom');
      setPhase('end');
      finish({ path: next }, 1400);
    } else if (res.safe) {
      puzzleSound('win');
      setPhase('end');
      finish({ path: next }, 1200);
    } else puzzleSound('tick');
  };
  const last = path[path.length - 1];
  return (
    <div className="pz pz-traps">
      <HelperNote state={state} yes={pl ? 'Zręczność: dłużej widzisz błysk ostrzy.' : 'Dexterity: you see the glint for longer.'} no={pl ? 'Błysk trwa tylko chwilę.' : 'The glint lasts only a moment.'} />
      <p className="pz-hint">
        {phase === 'ready' ? (pl ? 'Patrz uważnie…' : 'Watch closely…') : phase === 'flash' ? (pl ? 'Zapamiętaj pułapki!' : 'Remember the traps!') : phase === 'walk' ? (pl ? 'Idź od dołu do góry, pole po polu.' : 'Walk from the bottom to the top, square by square.') : walk.safe ? (pl ? 'Przeszedłeś bez szwanku!' : 'You made it across unharmed!') : (pl ? 'Trzask! Pułapka się zatrzaskuje.' : 'Snap! A trap springs shut.')}
      </p>
      <div className="pz-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }, (_, c) => {
          const trap = data.traps.includes(c);
          const show = phase === 'flash' || (phase === 'end' && trap);
          const reachable = phase === 'walk' && !path.includes(c) && (last === undefined ? c >= (size - 1) * size : Math.abs((last % size) - (c % size)) + Math.abs(Math.floor(last / size) - Math.floor(c / size)) === 1);
          return (
            <button key={c} className={`pz-cell ${show && trap ? 'trap' : ''} ${path.includes(c) ? 'walked' : ''} ${walk.trap === c ? 'sprung' : ''} ${reachable ? 'reach' : ''} ${c < size ? 'goal' : ''}`}
              onClick={() => step(c)} disabled={phase !== 'walk'} aria-label={pl ? `Pole ${c + 1}` : `Square ${c + 1}`}>
              {show && trap ? '✷' : path.includes(c) ? '•' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Rune lock ----------

const RUNE_PATHS = [
  'M8 4 V20 M8 8 L16 4 M8 12 L16 8',
  'M7 20 V4 L17 10 V20',
  'M8 4 V20 M8 8 L15 12 L8 16',
  'M8 20 V4 L15 8 L8 12 L15 20',
  'M12 4 V20 M12 10 L6 4 M12 10 L18 4',
  'M6 4 L18 20 M18 4 L6 20',
];
function RuneGlyph({ n }: { n: number }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={RUNE_PATHS[n % RUNE_PATHS.length]} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Lock({ data, state, done }: Props<'lock'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const symbols = state.puzzle.kind === 'lock' ? state.puzzle.symbols : 5;
  const [guesses, setGuesses] = useState<number[][]>([]);
  const [current, setCurrent] = useState<number[]>([]);
  const finish = useFinish(done);
  const solved = guesses.some((g) => lockHint(data.code, g).exact === data.code.length);
  const over = solved || guesses.length >= data.tries;
  const check = () => {
    if (current.length !== data.code.length || over) return;
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent([]);
    const ok = lockHint(data.code, current).exact === data.code.length;
    puzzleSound(ok ? 'win' : next.length >= data.tries ? 'wrong' : 'tick');
    if (ok || next.length >= data.tries) finish({ guesses: next }, 1500);
  };
  return (
    <div className="pz pz-lock">
      <p className="pz-hint">{pl ? 'Ułóż 3 różne runy. ● dobra runa na dobrym miejscu, ○ dobra runa na złym miejscu.' : 'Set 3 different runes. ● right rune, right place; ○ right rune, wrong place.'}</p>
      <HelperNote state={state} yes={pl ? 'Inteligencja: masz jedną próbę więcej.' : 'Intelligence: you get one more try.'} no={pl ? 'Bez dodatkowych prób.' : 'No extra tries.'} />
      <ol className="pz-guesses">
        {guesses.map((g, i) => {
          const h = lockHint(data.code, g);
          return (
            <li key={i}>
              <span className="pz-guess">{g.map((r, k) => <span key={k} className="pz-rune small"><RuneGlyph n={r} /></span>)}</span>
              <span className="pz-pegs">{'●'.repeat(h.exact)}{'○'.repeat(h.near)}{'·'.repeat(data.code.length - h.exact - h.near)}</span>
            </li>
          );
        })}
      </ol>
      {!over ? (
        <>
          <div className="pz-slots">
            {data.code.map((_, i) => (
              <button key={i} className={`pz-slot ${current[i] !== undefined ? 'full' : ''}`} onClick={() => setCurrent(current.filter((_, k) => k !== i))}>
                {current[i] !== undefined && <RuneGlyph n={current[i]!} />}
              </button>
            ))}
          </div>
          <div className="pz-tiles">
            {Array.from({ length: symbols }, (_, r) => (
              <button key={r} className="pz-tile pz-rune" disabled={current.includes(r) || current.length >= data.code.length} onClick={() => { puzzleSound('tick'); setCurrent([...current, r]); }}><RuneGlyph n={r} /></button>
            ))}
          </div>
          <button className="pz-go" disabled={current.length !== data.code.length} onClick={check}>{pl ? `Wciskam runy (${data.tries - guesses.length} prób)` : `Press the runes (${data.tries - guesses.length} tries)`}</button>
        </>
      ) : (
        <p className={`pz-verdict ${solved ? 'ok' : ''}`}>{solved ? (pl ? 'Skała drży i odsuwa się z łoskotem!' : 'The rock shudders and rolls aside!') : (pl ? 'Runy gasną. Mechanizm się zaciął.' : 'The runes go dark. The mechanism jams.')}</p>
      )}
    </div>
  );
}

// ---------- Higher or lower ----------

function HigherLower({ data, state, me, done }: Props<'higherLower'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [calls, setCalls] = useState<('higher' | 'lower')[]>([]);
  const [run, setRun] = useState(0);
  const [forgive, setForgive] = useState(data.forgive);
  const [note, setNote] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const finish = useFinish(done);
  const style = diceStyle(me.character.dice?.d10);
  const rounds = data.values.length - 1;
  const at = calls.length;
  const call = (c: 'higher' | 'lower') => {
    if (over || at >= rounds) return;
    const cur = data.values[at]!;
    const next = data.values[at + 1]!;
    const right = next === cur || (c === 'higher' ? next > cur : next < cur);
    const all = [...calls, c];
    setCalls(all);
    if (right) {
      puzzleSound('right');
      setRun(run + 1);
      setNote(next === cur ? (pl ? 'Remis liczy się na Twoją korzyść.' : 'A tie counts for you.') : null);
      if (at + 1 >= rounds) { setOver(true); finish({ calls: all }, 1300); }
    } else if (forgive > 0) {
      puzzleSound('wrong');
      setForgive(forgive - 1);
      setNote(pl ? 'Kupiec przymyka oko na tę pomyłkę.' : 'The merchant lets this one slide.');
      if (at + 1 >= rounds) { setOver(true); finish({ calls: all }, 1300); }
    } else {
      puzzleSound('wrong');
      setRun(0);
      setOver(true);
      setNote(pl ? 'Pomyłka! Kupiec wraca do pełnej ceny.' : 'Wrong! The merchant goes back to the full price.');
      finish({ calls: all }, 1600);
    }
  };
  const stop = () => {
    if (over) return;
    setOver(true);
    finish({ calls }, 200);
  };
  return (
    <div className="pz pz-hl">
      <p className="pz-hint">{pl ? 'Czy następny rzut k10 będzie wyższy, czy niższy? Każde trafienie obniża cenę, ale pomyłka zeruje serię. Możesz przestać w każdej chwili.' : 'Will the next d10 roll be higher or lower? Each right call lowers the price, but a miss wipes the run. You may stop at any time.'}</p>
      <HelperNote state={state} yes={pl ? 'Charyzma: kupiec wybaczy Ci jedną pomyłkę.' : 'Charisma: the merchant forgives one miss.'} no={pl ? 'Kupiec nie wybacza pomyłek.' : 'The merchant forgives nothing.'} />
      <div className="pz-dice-row">
        {data.values.slice(0, at + 1).slice(-3).map((v, i, arr) => (
          <motion.span key={`${at}-${i}`} className={i === arr.length - 1 ? 'now' : 'past'} initial={i === arr.length - 1 && at > 0 ? { rotate: -180, scale: 0.5 } : false} animate={{ rotate: 0, scale: 1 }}>
            <DieFace kind="d10" value={v} style={style} size={i === arr.length - 1 ? 64 : 40} />
          </motion.span>
        ))}
      </div>
      <div className="pz-strikes">{Array.from({ length: rounds }, (_, i) => <span key={i} className={i < run ? 'ok' : ''}>◆</span>)}</div>
      {note && <p className="pz-note">{note}</p>}
      {!over && (
        <div className="pz-hl-buttons">
          <button className="pz-go" onClick={() => call('higher')}>▲ {pl ? 'Wyżej' : 'Higher'}</button>
          <button className="pz-go" onClick={() => call('lower')}>▼ {pl ? 'Niżej' : 'Lower'}</button>
          <button className="pz-stop" onClick={stop}>{pl ? `Biorę cenę (seria ${run})` : `Take the price (run ${run})`}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Dig ----------

function Dig({ data, state, done }: Props<'dig'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [dug, setDug] = useState(0);
  const finish = useFinish(done);
  const res = digResult(data, dug);
  const over = res.bust || dug >= data.layers.length;
  const deeper = () => {
    if (over) return;
    const n = dug + 1;
    setDug(n);
    const r = digResult(data, n);
    const layer = data.layers[n - 1];
    puzzleSound(layer === 'curse' ? (r.bust ? 'boom' : 'wrong') : 'right');
    if (r.bust || n >= data.layers.length) finish({ dug: n }, 1700);
  };
  const leave = () => {
    if (over) return;
    finish({ dug }, 200);
  };
  const loot = res.loot as Outcome[];
  return (
    <div className="pz pz-dig">
      <p className="pz-hint">{pl ? 'Każda warstwa kryje coś cennego, ale gdzieś czai się klątwa. Zabierz łup, zanim będzie za późno.' : 'Every layer hides something precious, but a curse lurks somewhere. Take the loot before it is too late.'}</p>
      <HelperNote state={state} yes={pl ? 'Siła: pierwsza klątwa tylko Cię zrani, łup zostaje.' : 'Strength: the first curse only wounds you; the loot stays.'} no={pl ? 'Klątwa zabierze wszystko.' : 'A curse will take everything.'} />
      <div className="pz-layers">
        {data.layers.map((l, i) => (
          <div key={i} className={`pz-layer ${i < dug ? (l === 'curse' ? 'curse' : 'found') : ''}`}>
            {i < dug ? (l === 'curse' ? (pl ? '☠ Klątwa!' : '☠ A curse!') : outcomeText(l, locale)) : i === dug && !over ? (pl ? '? kolejna warstwa' : '? next layer') : ''}
          </div>
        ))}
      </div>
      <p className="pz-note">{res.bust ? (pl ? 'Łup obraca się w proch, a z bandaży wstaje mumia!' : 'The loot crumbles to dust as the mummy rises from its wrappings!') : loot.length ? `${pl ? 'Twój łup: ' : 'Your loot: '}${outcomeText(loot, locale)}` : (pl ? 'Na razie nic nie masz.' : 'Nothing yet.')}</p>
      {!over && (
        <div className="pz-hl-buttons">
          <button className="pz-go" onClick={deeper}>{pl ? 'Sięgam głębiej' : 'Reach deeper'}</button>
          <button className="pz-stop" onClick={leave}>{pl ? 'Zabieram łup' : 'Take the loot'}</button>
        </div>
      )}
    </div>
  );
}

/** The mini-game of a card, by kind. */
export function PuzzleView({ state, me, done }: { state: PuzzleState; me: PlayerState; done: Done }) {
  const d = state.data;
  const common = { state, me, done };
  switch (d.kind) {
    case 'riddle': return <Riddle data={d} {...common} />;
    case 'quiz': return <Quiz data={d} {...common} />;
    case 'cups': return <Cups data={d} {...common} />;
    case 'forge': case 'climb': return <Timing data={d} {...common} />;
    case 'chests': return <Chests data={d} {...common} />;
    case 'traps': return <Traps data={d} {...common} />;
    case 'lock': return <Lock data={d} {...common} />;
    case 'higherLower': return <HigherLower data={d} {...common} />;
    case 'dig': return <Dig data={d} {...common} />;
  }
}

