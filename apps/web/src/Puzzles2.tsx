import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { bluffTrue, slid, slide, starScore, type PuzzleState } from '@hp/engine';
import { DieFace, diceStyle } from './DiceFace';
import { puzzleNote, puzzleSound } from './Feedback';
import { itemName } from './logText';
import { attrName } from './outcomeText';
import { HelperNote, Hourglass, reduced, useCountdown, useFinish, type Props } from './Puzzles';
import { useT } from './i18n';

/**
 * The second set of mini-games: tunes, escapes, differences, strength, pairs, focus, the thief,
 * the scales, the stars, the Nomad's dice, fireflies and the sliding fresco. Each one is shaped
 * by one of the hero's attributes (shown above it), as Jacob asked: the stat matters directly.
 */

/** What the hero's attribute does in each mini-game, shown above it. */
const STAT_EFFECT: Record<PuzzleState['data']['kind'], [string, string]> = {
  riddle: ['mniej fałszywych liter', 'fewer false letters'],
  quiz: ['więcej czasu na każde pytanie', 'more time for each question'],
  cups: ['wolniejsze tasowanie', 'a slower shuffle'],
  forge: ['szersza strefa uderzenia', 'a wider striking zone'],
  climb: ['szersza strefa chwytu', 'a wider zone'],
  chests: ['', ''],
  traps: ['dłużej widzisz pułapki', 'you see the traps for longer'],
  lock: ['od 40: dodatkowa próba', 'from 40: an extra try'],
  higherLower: ['od 40: kupiec wybacza jedną pomyłkę więcej', 'from 40: the merchant forgives one more miss'],
  dig: ['czasem ostrzega przed zagrożeniem o krok wcześniej', 'sometimes warns of danger one step ahead'],
  sequence: ['wolniejsza melodia', 'a slower tune'],
  escape: ['ziemia ustępuje wolniej', 'the ground gives way slower'],
  differences: ['więcej czasu', 'more time'],
  tug: ['przewaga na starcie i mocniejszy chwyt', 'a head start and a stronger grip'],
  pairs: ['dłużej widzisz odkryte karty', 'a longer look at the cards'],
  hold: ['szersza strefa skupienia', 'a wider zone of focus'],
  missing: ['dłużej widzisz plecak', 'a longer look at the pack'],
  scale: ['od 40: trzecie ważenie', 'from 40: a third weighing'],
  stars: ['znak blednie wolniej', 'the sign fades slower'],
  bluff: ['łatwiej wyczytasz blef z jego miny', 'you read a bluff in his face more easily'],
  catch: ['świetliki świecą dłużej', 'the fireflies glow longer'],
  slider: ['fresk jest mniej pomieszany', 'the fresco is less jumbled'],
};

/** The hero's attribute and what it does here, with a small meter of how far it helps. */
export function StatNote({ state }: { state: PuzzleState }) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const s = state.stat;
  const effect = STAT_EFFECT[state.data.kind];
  if (!s || !effect[0]) return null;
  return (
    <p className="pz-stat" title={pl ? 'Twoja cecha z modyfikatorami' : 'Your attribute with modifiers'}>
      <b>{attrName(s.attribute, locale)} {s.value}</b>
      <span className="pz-stat-meter" aria-hidden="true"><span style={{ width: `${Math.round(s.power * 100)}%` }} /></span>
      <span>{effect[pl ? 0 : 1]}</span>
    </p>
  );
}

const wait = (ms: number) => (reduced() ? Math.min(ms, 250) : ms);

// ---------- Tune: listen, then play it back ----------

const PAD_COLOURS = ['#7ee2ff', '#ffd166', '#c8a0ff', '#7ee2a0', '#ff9a8a'];

export function Sequence({ data, state, done }: Props<'sequence'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const theme = state.puzzle.kind === 'sequence' ? state.puzzle.theme : 'ghost';
  const [phase, setPhase] = useState<'listen' | 'play' | 'end'>('listen');
  const [lit, setLit] = useState<number | null>(null);
  const [played, setPlayed] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [replays, setReplays] = useState(data.replays);
  const [round, setRound] = useState(0);
  const finish = useFinish(done);
  const tempo = (i: number) => Math.round(data.tempoMs * (data.speedUp ? Math.max(0.5, 1 - 0.09 * i) : 1));
  useEffect(() => {
    if (phase !== 'listen') return;
    let cancelled = false;
    const timers: number[] = [];
    let at = 700;
    data.notes.forEach((n, i) => {
      const ms = tempo(i);
      timers.push(window.setTimeout(() => { if (!cancelled) { setLit(n); puzzleNote(n, theme, ms); } }, at));
      timers.push(window.setTimeout(() => { if (!cancelled) setLit(null); }, at + ms * 0.75));
      at += ms;
    });
    timers.push(window.setTimeout(() => { if (!cancelled) setPhase('play'); }, at + 200));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);
  const tap = (n: number) => {
    if (phase !== 'play') return;
    puzzleNote(n, theme, 260);
    setLit(n);
    setTimeout(() => setLit(null), 180);
    if (data.notes[played] !== n) {
      setWrong(true);
      setPhase('end');
      puzzleSound('wrong');
      finish({ hits: played }, 1300);
      return;
    }
    const next = played + 1;
    setPlayed(next);
    if (next >= data.notes.length) {
      setPhase('end');
      puzzleSound('win');
      finish({ hits: next }, 1300);
    }
  };
  const again = () => {
    if (phase !== 'play' || played > 0 || replays <= 0) return;
    setReplays(replays - 1);
    setRound(round + 1);
    setPhase('listen');
  };
  const who = theme === 'ghost' ? (pl ? 'Duch zawodzi' : 'The ghost wails') : theme === 'witch' ? (pl ? 'Czarownica śpiewa' : 'The witch sings') : (pl ? 'Bard gra' : 'The bard plays');
  return (
    <div className={`pz pz-seq t-${theme}`}>
      <HelperNote state={state} yes={pl ? 'Możesz posłuchać jeszcze raz.' : 'You may hear it once more.'} no={pl ? 'Usłyszysz to tylko raz.' : 'You hear it only once.'} />
      <p className="pz-hint">
        {phase === 'listen' ? `${who}… ${pl ? 'słuchaj uważnie' : 'listen closely'} (${data.notes.length} ${pl ? 'tonów' : 'notes'})`
          : phase === 'play' ? (pl ? `Powtórz melodię: ${played}/${data.notes.length}` : `Play it back: ${played}/${data.notes.length}`)
          : wrong ? (pl ? `Fałszywy ton! Zagrałeś dobrze ${played} z ${data.notes.length}.` : `A false note! You played ${played} of ${data.notes.length} right.`)
          : (pl ? 'Czysto! Melodia brzmi bez skazy.' : 'Pure! The tune rings flawless.')}
      </p>
      <div className="pz-pads" style={{ gridTemplateColumns: `repeat(${data.tones}, 1fr)` }}>
        {Array.from({ length: data.tones }, (_, n) => (
          <motion.button key={n} className={`pz-pad ${lit === n ? 'lit' : ''}`} style={{ '--pad': PAD_COLOURS[n] } as CSSProperties}
            onPointerDown={() => tap(n)} disabled={phase !== 'play'} whileTap={{ scale: 0.92 }} aria-label={`${pl ? 'Ton' : 'Note'} ${n + 1}`}>
            {theme === 'lute' ? '♪' : theme === 'witch' ? '❦' : '◌'}
          </motion.button>
        ))}
      </div>
      <div className="pz-strikes">{data.notes.map((_, i) => <span key={i} className={i < played ? 'ok' : wrong && i === played ? 'no' : ''}>●</span>)}</div>
      {phase === 'play' && replays > 0 && played === 0 && <button className="pz-stop" onClick={again}>{pl ? 'Posłuchaj jeszcze raz' : 'Hear it again'}</button>}
    </div>
  );
}

// ---------- Escape: the field falls away (or burns) behind you ----------

export function Escape({ data, state, done }: Props<'escape'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const fire = state.puzzle.kind === 'escape' && state.puzzle.theme === 'fire';
  const { size } = data;
  const [phase, setPhase] = useState<'ready' | 'run' | 'end'>('ready');
  const [pos, setPos] = useState(data.start);
  const [tick, setTick] = useState(0);
  const [burns, setBurns] = useState(0);
  const [won, setWon] = useState(false);
  const lastStep = useRef(0);
  const posRef = useRef(pos);
  posRef.current = pos;
  const burnsRef = useRef(0);
  const finish = useFinish(done);
  const taken = new Set(data.order.slice(0, tick * data.perTick));
  const holes = new Set(data.holes);
  const end = useCallback((escaped: boolean, b: number) => {
    setPhase('end');
    setWon(escaped);
    puzzleSound(escaped ? 'win' : fire ? 'wrong' : 'boom');
    finish({ escaped, burns: b }, 1400);
  }, [finish, fire]);
  useEffect(() => {
    if (phase === 'ready') {
      const id = setTimeout(() => setPhase('run'), wait(1400));
      return () => clearTimeout(id);
    }
    if (phase !== 'run') return;
    const id = setInterval(() => setTick((t) => t + 1), reduced() ? data.tickMs * 2 : data.tickMs);
    return () => clearInterval(id);
  }, [phase, data.tickMs]);
  // The ground reaches the hero.
  useEffect(() => {
    if (phase !== 'run' || tick === 0) return;
    const fresh = data.order.slice((tick - 1) * data.perTick, tick * data.perTick);
    if (!fresh.includes(posRef.current)) return;
    if (!fire) end(false, burnsRef.current);
    else {
      burnsRef.current += 1;
      setBurns(burnsRef.current);
      puzzleSound('wrong');
      if (burnsRef.current >= 3) end(false, burnsRef.current);
    }
  }, [tick, phase, data, fire, end]);
  const near = (a: number, b: number) => Math.abs((a % size) - (b % size)) + Math.abs(Math.floor(a / size) - Math.floor(b / size)) === 1;
  const step = (c: number) => {
    if (phase !== 'run' || !near(pos, c) || holes.has(c)) return;
    const now = performance.now();
    if (now - lastStep.current < data.stepMs) return;
    if (!fire && taken.has(c)) return;
    lastStep.current = now;
    setPos(c);
    if (fire && taken.has(c)) {
      burnsRef.current += 1;
      setBurns(burnsRef.current);
      puzzleSound('wrong');
      if (burnsRef.current >= 3) { end(false, burnsRef.current); return; }
    } else puzzleSound('tick');
    if (data.exits.includes(c)) end(true, burnsRef.current);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = { ArrowUp: -size, ArrowDown: size, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      step(posRef.current + d);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <div className={`pz pz-escape ${fire ? 't-fire' : 't-void'}`}>
      <p className="pz-hint">
        {phase === 'ready' ? (pl ? 'Biegnij do jasnych pól na brzegu! Stukaj w sąsiednie pole (lub strzałki).' : 'Run for the bright squares at the edge! Tap a square next to you (or use the arrows).')
          : phase === 'run' ? (fire ? (pl ? `Ogień się szerzy! Oparzenia: ${burns}/3` : `The fire spreads! Burns: ${burns}/3`) : (pl ? 'Ziemia zapada się w ciemność!' : 'The ground falls into darkness!'))
          : won ? (pl ? 'Jesteś bezpieczny!' : 'You are safe!') : fire ? (pl ? 'Dym i ogień Cię dopadają!' : 'Smoke and fire overwhelm you!') : (pl ? 'Grunt znika pod Twoimi stopami!' : 'The ground vanishes under your feet!')}
      </p>
      <div className="pz-grid pz-escape-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }, (_, c) => {
          const gone = holes.has(c) || (!fire && taken.has(c));
          const burning = fire && taken.has(c);
          const reach = phase === 'run' && near(pos, c) && !gone;
          return (
            <button key={c} onClick={() => step(c)} disabled={phase !== 'run'}
              className={`pz-cell ${gone ? 'is-gone' : ''} ${burning ? 'is-burning' : ''} ${data.exits.includes(c) ? 'is-exit' : ''} ${reach ? 'reach' : ''} ${c === pos ? 'is-hero' : ''}`}
              aria-label={`${pl ? 'Pole' : 'Square'} ${c + 1}`}>
              {c === pos ? '☺' : burning ? '🔥' : data.exits.includes(c) ? '⌂' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Differences: you and your reflection ----------

const CLOAK = ['#c84a3a', '#3a6ac8', '#3a8a4a'];
function DiffPicture({ v, onTap, marks, glint }: { v: number[]; onTap?: (region: number) => void; marks?: number[]; glint?: number | null }) {
  const hit = (r: number) => (onTap ? { onClick: () => onTap(r), style: { cursor: 'pointer' } } : {});
  const ring = (r: number, x: number, y: number, rad: number) => (
    <>
      {marks?.includes(r) && <circle cx={x} cy={y} r={rad} fill="none" stroke="#7ee2a0" strokeWidth="2.5" />}
      {glint === r && !marks?.includes(r) && <circle className="pz-glint" cx={x} cy={y} r={rad} fill="none" stroke="#fff3d6" strokeWidth="1.5" strokeDasharray="3 3" />}
    </>
  );
  return (
    <svg viewBox="0 0 120 120" className="pz-diff-pic">
      <rect width="120" height="120" fill="#1a2a4a" />
      <rect y="92" width="120" height="28" fill="#2f5a34" />
      {/* 6 sky */}
      <g {...hit(6)}>
        <rect x="80" y="4" width="36" height="30" fill="transparent" />
        {v[6] === 0 && <path d="M100 8 a10 10 0 1 0 8 16 a8 8 0 1 1 -8 -16z" fill="#fff3c0" />}
        {v[6] === 1 && <circle cx="100" cy="18" r="9" fill="#fff3c0" />}
        {v[6] === 2 && <><circle cx="92" cy="12" r="2" fill="#fff" /><circle cx="106" cy="22" r="2" fill="#fff" /><circle cx="98" cy="28" r="1.5" fill="#fff" /></>}
        {ring(6, 98, 18, 15)}
      </g>
      {/* 7 bird */}
      <g {...hit(7)}>
        <rect x="6" y="6" width="34" height="24" fill="transparent" />
        {v[7] !== 1 && <path d="M12 18 q5 -6 10 0 q5 -6 10 0" fill="none" stroke="#0b0b10" strokeWidth="2" />}
        {v[7] === 2 && <path d="M20 26 q3 -4 6 0 q3 -4 6 0" fill="none" stroke="#0b0b10" strokeWidth="1.6" />}
        {ring(7, 22, 18, 14)}
      </g>
      {/* 8 tree */}
      <g {...hit(8)}>
        <rect x="88" y="40" width="30" height="56" fill="transparent" />
        <rect x="100" y="70" width="6" height="24" fill="#5a3a1e" />
        {v[8] === 0 && <path d="M103 40 L116 72 L90 72 Z" fill="#2a6a34" />}
        {v[8] === 1 && <circle cx="103" cy="60" r="14" fill="#3a7a3e" />}
        {v[8] === 2 && <path d="M103 72 L103 50 M103 58 L94 48 M103 62 L112 52" stroke="#5a3a1e" strokeWidth="3" />}
        {ring(8, 103, 62, 18)}
      </g>
      {/* 9 flower */}
      <g {...hit(9)}>
        <rect x="6" y="88" width="24" height="26" fill="transparent" />
        <path d="M16 112 V100" stroke="#2a6a34" strokeWidth="2" />
        {v[9] !== 2 && <circle cx="16" cy="98" r="4" fill={v[9] === 0 ? '#ff5a6a' : '#ffd166'} />}
        {ring(9, 16, 102, 11)}
      </g>
      {/* hero body */}
      <circle cx="58" cy="38" r="9" fill="#f2c9a0" stroke="#1a120c" strokeWidth="1.5" />
      {/* 1 cloak */}
      <g {...hit(1)}>
        <path d="M44 50 L72 50 L78 92 L38 92 Z" fill={CLOAK[v[1]!]} stroke="#1a120c" strokeWidth="1.5" />
        {ring(1, 58, 76, 12)}
      </g>
      {/* 0 hat */}
      <g {...hit(0)}>
        <rect x="44" y="16" width="28" height="20" fill="transparent" />
        {v[0] === 0 && <path d="M47 32 L58 12 L69 32 Z" fill="#6a4ac8" stroke="#1a120c" strokeWidth="1.5" />}
        {v[0] === 1 && <><path d="M48 32 Q58 22 68 32 Z" fill="#8a5a30" stroke="#1a120c" strokeWidth="1.5" /><path d="M66 28 q8 -10 4 -16" stroke="#ff5a3a" strokeWidth="2" fill="none" /></>}
        {v[0] === 2 && <path d="M48 36 Q58 20 68 36" fill="none" stroke={CLOAK[v[1]!]} strokeWidth="4" />}
        {ring(0, 58, 26, 13)}
      </g>
      {/* 4 belt */}
      <g {...hit(4)}>
        <rect x="42" y="68" width="32" height="6" fill="#3a2410" />
        {v[4] === 0 && <rect x="55" y="67" width="7" height="8" fill="#ffd166" stroke="#1a120c" />}
        {v[4] === 2 && <rect x="64" y="72" width="8" height="8" rx="2" fill="#8a5a30" stroke="#1a120c" />}
        {ring(4, 58, 71, 9)}
      </g>
      {/* 5 boots */}
      <g {...hit(5)}>
        <rect x="44" y={v[5] === 2 ? 84 : 90} width="10" height={v[5] === 2 ? 10 : 4} fill={v[5] === 1 ? '#1a1a22' : '#6a3a1a'} />
        <rect x="62" y={v[5] === 2 ? 84 : 90} width="10" height={v[5] === 2 ? 10 : 4} fill={v[5] === 1 ? '#1a1a22' : '#6a3a1a'} />
        {ring(5, 58, 91, 14)}
      </g>
      {/* 2 weapon */}
      <g {...hit(2)}>
        <rect x="72" y="36" width="16" height="52" fill="transparent" />
        {v[2] === 0 && <path d="M80 86 V44 L82 40 L84 44 V86 M76 74 H88" stroke="#d8d8e8" strokeWidth="2.5" fill="none" />}
        {v[2] === 1 && <><path d="M81 86 V46" stroke="#6a4a2a" strokeWidth="3" /><path d="M81 48 q8 2 6 12 q-4 -4 -6 -4 Z" fill="#c8c8d8" stroke="#1a120c" /></>}
        {v[2] === 2 && <><path d="M81 88 V40" stroke="#8a5a30" strokeWidth="3" /><circle cx="81" cy="38" r="4" fill="#7ee2ff" /></>}
        {ring(2, 81, 62, 14)}
      </g>
      {/* 3 shield */}
      <g {...hit(3)}>
        <rect x="26" y="52" width="20" height="30" fill="transparent" />
        {v[3] === 0 && <circle cx="38" cy="66" r="9" fill="#a07030" stroke="#1a120c" strokeWidth="1.5" />}
        {v[3] === 1 && <path d="M30 56 H46 V66 Q46 78 38 82 Q30 78 30 66 Z" fill="#c8c8d8" stroke="#1a120c" strokeWidth="1.5" />}
        {ring(3, 38, 66, 13)}
      </g>
    </svg>
  );
}

export function Differences({ data, state, done }: Props<'differences'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [found, setFound] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [over, setOver] = useState(false);
  const finish = useFinish(done);
  const changedBy = new Map(data.changed.map((c) => [c.region, c.variant]));
  const mirror = data.base.map((b, i) => changedBy.get(i) ?? b);
  const end = (f: number[]) => {
    if (over) return;
    setOver(true);
    puzzleSound(f.length >= 3 ? 'win' : f.length >= 2 ? 'right' : 'wrong');
    finish({ found: f }, 1400);
  };
  const time = useCountdown(data.seconds, !over, () => end(found));
  const tap = (r: number) => {
    if (over || found.includes(r)) return;
    if (changedBy.has(r)) {
      const f = [...found, r];
      setFound(f);
      puzzleSound('right');
      if (f.length >= data.changed.length) end(f);
    } else {
      puzzleSound('wrong');
      const m = misses + 1;
      setMisses(m);
      if (m >= 4) end(found);
    }
  };
  return (
    <div className="pz pz-diff">
      <HelperNote state={state} yes={pl ? 'Siła Woli: jedna różnica lekko lśni.' : 'Willpower: one difference glints faintly.'} no={pl ? 'Tafla nic nie podpowiada.' : 'The water gives no hint.'} />
      <Hourglass {...time} />
      <p className="pz-hint">{pl ? `Stukaj w różnice na odbiciu (po prawej). Znalezione: ${found.length}/3 · pomyłki: ${misses}/4` : `Tap the differences on the reflection (right). Found: ${found.length}/3 · misses: ${misses}/4`}</p>
      <div className="pz-diff-row">
        <figure><DiffPicture v={data.base} /><figcaption>{pl ? 'Ty' : 'You'}</figcaption></figure>
        <figure className="reflection"><DiffPicture v={mirror} onTap={tap} marks={over ? data.changed.map((c) => c.region) : found} glint={data.hint} /><figcaption>{pl ? 'Odbicie' : 'Reflection'}</figcaption></figure>
      </div>
    </div>
  );
}

// ---------- Tug: arm wrestling ----------

export function Tug({ data, done }: Props<'tug'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [phase, setPhase] = useState<'ready' | 'pull' | 'end'>('ready');
  const [pos, setPos] = useState(data.start);
  const posRef = useRef(data.start);
  const started = useRef(0);
  const finish = useFinish(done);
  const end = useCallback((won: boolean) => {
    setPhase('end');
    puzzleSound(won ? 'win' : 'wrong');
    finish({ won }, 1400);
  }, [finish]);
  useEffect(() => {
    if (phase === 'ready') {
      const id = setTimeout(() => { started.current = performance.now(); setPhase('pull'); }, wait(1500));
      return () => clearTimeout(id);
    }
    if (phase !== 'pull') return;
    const id = setInterval(() => {
      const t = (performance.now() - started.current) / 1000;
      const surge = data.surges.some((s) => t >= s && t < s + 0.6) ? 0.5 : 0;
      posRef.current -= (data.pull + surge) * 0.05 * (reduced() ? 0.6 : 1);
      setPos(posRef.current);
      if (posRef.current <= -1) end(false);
      else if (t >= data.seconds) end(posRef.current > 0);
    }, 50);
    return () => clearInterval(id);
  }, [phase, data, end]);
  const push = useCallback(() => {
    if (phase !== 'pull') return;
    posRef.current = Math.min(1, posRef.current + data.tap);
    setPos(posRef.current);
    if (posRef.current >= 1) end(true);
  }, [phase, data.tap, end]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); push(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [push]);
  const t = phase === 'pull' ? (performance.now() - started.current) / 1000 : 0;
  const surging = phase === 'pull' && data.surges.some((s) => t >= s && t < s + 0.6);
  return (
    <div className="pz pz-tug">
      <p className="pz-hint">
        {phase === 'ready' ? (pl ? 'Łokcie na pniu… Stukaj jak najszybciej, gdy padnie „Start!”' : 'Elbows on the stump… Tap as fast as you can at "Go!"')
          : phase === 'pull' ? (surging ? (pl ? 'Skałogrzmot napiera całym ciężarem!' : 'The Flintborn throws his whole weight in!') : (pl ? 'Ciśnij!' : 'Push!'))
          : pos > 0 ? (pl ? 'Ręka Skałogrzmota uderza o pień. Wygrana!' : "The Flintborn's hand slams the stump. You win!") : (pl ? 'Twoja ręka ląduje na pniu.' : 'Your hand hits the stump.')}
      </p>
      <div className="pz-tug-bar" aria-label={pl ? 'Przewaga' : 'Advantage'}>
        <span className="pz-tug-me" style={{ width: `${((pos + 1) / 2) * 100}%` }} />
        <motion.span className="pz-tug-knot" animate={{ left: `${((pos + 1) / 2) * 100}%` }} transition={{ duration: 0.05 }}>✊</motion.span>
        <i style={{ left: '50%' }} />
      </div>
      <div className="pz-tug-sides"><span>{pl ? 'Ty' : 'You'}</span><span>{pl ? 'Skałogrzmot' : 'Flintborn'}</span></div>
      <motion.button className="pz-go big" onPointerDown={push} disabled={phase !== 'pull'} whileTap={{ scale: 0.9 }}>{phase === 'ready' ? '…' : pl ? 'Ciśnij!' : 'Push!'}</motion.button>
    </div>
  );
}

// ---------- Pairs: herb memory ----------

const HERB_LOOK = [
  { c: '#7ee2a0', d: 'M12 22 Q4 12 12 2 Q20 12 12 22 Z' },
  { c: '#ffd166', d: 'M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z' },
  { c: '#c8a0ff', d: 'M12 22 V10 M12 10 Q6 4 4 10 Q8 12 12 10 Q16 12 20 10 Q18 4 12 10' },
  { c: '#ff9a8a', d: 'M12 3 a4 4 0 1 1 0 8 a4 4 0 1 1 0 -8 M6 10 a4 4 0 1 1 0 8 a4 4 0 1 1 0 -8 M18 10 a4 4 0 1 1 0 8 a4 4 0 1 1 0 -8' },
  { c: '#7ee2ff', d: 'M12 2 Q20 8 12 22 Q4 8 12 2 M12 6 V20' },
  { c: '#f2e2bd', d: 'M6 20 Q12 2 18 20 M9 14 H15' },
];

export function Pairs({ data, state, done }: Props<'pairs'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [phase, setPhase] = useState<'peek' | 'play' | 'end'>('peek');
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const finish = useFinish(done);
  const pairs = data.cards.length / 2;
  useEffect(() => {
    if (phase !== 'peek') return;
    const id = setTimeout(() => setPhase('play'), wait(data.peekMs + 400));
    return () => clearTimeout(id);
  }, [phase, data.peekMs]);
  const flip = (i: number) => {
    if (phase !== 'play' || open.length >= 2 || open.includes(i) || found.includes(data.cards[i]!)) return;
    puzzleSound('tick');
    const o = [...open, i];
    setOpen(o);
    if (o.length < 2) return;
    const m = moves + 1;
    setMoves(m);
    const same = data.cards[o[0]!] === data.cards[o[1]!];
    const f = same ? [...found, data.cards[i]!] : found;
    if (same) { setFound(f); puzzleSound('right'); }
    setTimeout(() => {
      setOpen([]);
      if (f.length >= pairs || m >= data.moves) {
        setPhase('end');
        puzzleSound(f.length >= pairs ? 'win' : f.length ? 'right' : 'wrong');
        finish({ hits: f.length }, 900);
      }
    }, wait(same ? 350 : 800));
  };
  return (
    <div className="pz pz-pairs">
      <HelperNote state={state} yes={pl ? 'Inteligencja: masz 2 ruchy więcej.' : 'Intelligence: two more moves.'} no={pl ? 'Bez dodatkowych ruchów.' : 'No extra moves.'} />
      <p className="pz-hint">
        {phase === 'peek' ? (pl ? 'Zapamiętaj zioła…' : 'Remember the herbs…') : phase === 'play' ? (pl ? `Odkrywaj pary. Ruchy: ${data.moves - moves} · pary: ${found.length}/${pairs}` : `Find the pairs. Moves: ${data.moves - moves} · pairs: ${found.length}/${pairs}`) : (pl ? `Koniec! Znalezione pary: ${found.length}` : `Done! Pairs found: ${found.length}`)}
      </p>
      <div className="pz-pair-grid">
        {data.cards.map((c, i) => {
          const face = phase === 'peek' || phase === 'end' || open.includes(i) || found.includes(c);
          const look = HERB_LOOK[c % HERB_LOOK.length]!;
          return (
            <motion.button key={i} className={`pz-pair ${face ? 'face' : ''} ${found.includes(c) ? 'found' : ''}`} onClick={() => flip(i)} disabled={phase !== 'play'}
              animate={{ rotateY: face ? 0 : 180 }} transition={{ duration: 0.25 }} aria-label={face ? `${pl ? 'Zioło' : 'Herb'} ${c + 1}` : (pl ? 'Zakryta karta' : 'Face-down card')}>
              {face && <svg viewBox="0 0 24 24" aria-hidden="true"><path d={look.d} fill={look.c} stroke="#1a120c" strokeWidth="1.2" /></svg>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Hold: keep your focus in the drifting zone ----------

export function Hold({ data, done }: Props<'hold'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [phase, setPhase] = useState<'ready' | 'run' | 'end'>('ready');
  const [marker, setMarker] = useState(0.5);
  const [zone, setZone] = useState(data.path[0]!);
  const [share, setShare] = useState(0);
  const pressed = useRef(false);
  const finish = useFinish(done);
  useEffect(() => {
    if (phase === 'ready') {
      const id = setTimeout(() => setPhase('run'), wait(1300));
      return () => clearTimeout(id);
    }
    if (phase !== 'run') return;
    const t0 = performance.now();
    let last = t0;
    let m = 0.5;
    let v = 0;
    let inside = 0;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      const k = Math.min(data.path.length - 1.001, t * 2);
      const i = Math.floor(k);
      const z = data.path[i]! + (data.path[i + 1]! - data.path[i]!) * (k - i);
      v += (pressed.current ? 1.6 : -1.6) * dt;
      v = Math.max(-0.7, Math.min(0.7, v * 0.97));
      m = Math.max(0, Math.min(1, m + v * dt));
      if (m <= 0 || m >= 1) v = 0;
      if (Math.abs(m - z) <= data.width / 2) inside += dt;
      setMarker(m);
      setZone(z);
      setShare(inside / Math.max(0.001, t));
      if (t >= data.seconds) {
        const frac = inside / data.seconds;
        const tier = frac >= 0.8 ? 3 : frac >= 0.6 ? 2 : frac >= 0.4 ? 1 : 0;
        setPhase('end');
        puzzleSound(tier >= 2 ? 'win' : tier ? 'right' : 'wrong');
        finish({ hits: tier }, 1200);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, data, finish]);
  const down = () => { pressed.current = true; };
  const up = () => { pressed.current = false; };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); down(); } };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') up(); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);
  const inZone = Math.abs(marker - zone) <= data.width / 2;
  return (
    <div className="pz pz-hold">
      <p className="pz-hint">{phase === 'ready' ? (pl ? 'Przytrzymaj przycisk, by unieść myśl; puść, by opadła. Trzymaj ją w świetlistej strefie.' : 'Hold the button to lift your thought, let go to let it sink. Keep it in the glowing zone.') : phase === 'run' ? (pl ? `Skupienie: ${Math.round(share * 100)}%` : `Focus: ${Math.round(share * 100)}%`) : (pl ? `Medytacja skończona: ${Math.round(share * 100)}% skupienia.` : `Meditation over: ${Math.round(share * 100)}% focus.`)}</p>
      <div className="pz-hold-bar">
        <span className={`pz-hold-zone ${inZone ? 'in' : ''}`} style={{ bottom: `${(zone - data.width / 2) * 100}%`, height: `${data.width * 100}%` }} />
        <span className="pz-hold-marker" style={{ bottom: `${marker * 100}%` }} />
      </div>
      <button className="pz-go big" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} disabled={phase === 'end'}>{pl ? 'Przytrzymaj' : 'Hold'}</button>
    </div>
  );
}

// ---------- The thief: what is missing? ----------

export function Missing({ data, done }: Props<'missing'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [phase, setPhase] = useState<'show' | 'ask' | 'end'>('show');
  const [pick, setPick] = useState<number | null>(null);
  const finish = useFinish(done);
  useEffect(() => {
    if (phase !== 'show') return;
    const id = setTimeout(() => setPhase('ask'), wait(data.showMs + 500));
    return () => clearTimeout(id);
  }, [phase, data.showMs]);
  const stolen = data.shown[data.stolen]!;
  const choose = (i: number) => {
    if (phase !== 'ask') return;
    setPick(i);
    setPhase('end');
    const ok = data.options[i] === stolen;
    puzzleSound(ok ? 'win' : 'wrong');
    finish({ pick: i }, 1500);
  };
  const ok = pick !== null && data.options[pick] === stolen;
  return (
    <div className="pz pz-missing">
      <p className="pz-hint">
        {phase === 'show' ? (pl ? 'Chochlik pokazuje Twój plecak. Zapamiętaj, co w nim jest!' : 'The imp shows you your pack. Remember what is inside!')
          : phase === 'ask' ? (pl ? 'Chochlik coś schował za plecami. Czego brakuje?' : 'The imp hid something behind his back. What is missing?')
          : ok ? (pl ? 'Zgadłeś! Chochlik ze wstydem oddaje zgubę i jeszcze dorzuca monety.' : 'Right! The imp hands it back in shame and adds a few coins.')
          : (pl ? `Pudło! Chochlik ucieka z: ${itemName(stolen, locale)}${data.real ? '' : ' (i 2 zł)'}.` : `Wrong! The imp runs off with: ${itemName(stolen, locale)}${data.real ? '' : ' (and 2 gold)'}.`)}
      </p>
      <div className="pz-bag">
        {data.shown.map((id, i) => (
          <motion.span key={id} className={`pz-bag-item ${phase !== 'show' && i === data.stolen ? 'gone' : ''}`} animate={{ scale: phase !== 'show' && i === data.stolen ? [1, 0.6, 1] : 1 }}>
            {phase !== 'show' && i === data.stolen ? '?' : itemName(id, locale)}
          </motion.span>
        ))}
      </div>
      {phase !== 'show' && (
        <div className="pz-answers">
          {data.options.map((id, i) => (
            <button key={id} className={`pz-answer ${phase === 'end' && id === stolen ? 'right' : ''} ${phase === 'end' && pick === i && id !== stolen ? 'wrong' : ''}`} disabled={phase !== 'ask'} onClick={() => choose(i)}>
              {itemName(id, locale)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- The keeper's scales ----------

export function Scale({ data, done }: Props<'scale'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [side, setSide] = useState<(0 | 1 | 2)[]>(() => Array.from({ length: data.coins }, () => 0));
  const [log, setLog] = useState<{ left: number[]; right: number[]; tilt: -1 | 0 | 1 }[]>([]);
  const [mode, setMode] = useState<'weigh' | 'pick' | 'end'>('weigh');
  const [pick, setPick] = useState<number | null>(null);
  const finish = useFinish(done);
  const left = side.flatMap((s, i) => (s === 1 ? [i] : []));
  const right = side.flatMap((s, i) => (s === 2 ? [i] : []));
  const tilt = log[log.length - 1]?.tilt ?? 0;
  const weigh = () => {
    if (left.length === 0 || left.length !== right.length || log.length >= data.weighings) return;
    const t: -1 | 0 | 1 = left.includes(data.fake) ? -1 : right.includes(data.fake) ? 1 : 0;
    puzzleSound('clang');
    const next = [...log, { left, right, tilt: t }];
    setLog(next);
    setSide(side.map(() => 0));
    if (next.length >= data.weighings) setMode('pick');
  };
  const tap = (i: number) => {
    if (mode === 'weigh') setSide(side.map((s, k) => (k === i ? ((s + 1) % 3) as 0 | 1 | 2 : s)));
    else if (mode === 'pick') {
      setPick(i);
      setMode('end');
      const ok = i === data.fake;
      puzzleSound(ok ? 'win' : 'wrong');
      finish({ pick: i }, 1600);
    }
  };
  const coinName = (i: number) => String.fromCharCode(65 + i);
  return (
    <div className="pz pz-scale">
      <p className="pz-hint">
        {mode === 'weigh' ? (pl ? `Stuknij monetę: raz na lewą szalkę, dwa razy na prawą. Na obu musi być tyle samo. Ważenia: ${data.weighings - log.length}` : `Tap a coin: once for the left pan, twice for the right. Both pans need the same number. Weighings left: ${data.weighings - log.length}`)
          : mode === 'pick' ? (pl ? 'Która moneta jest fałszywa? Wskaż ją.' : 'Which coin is false? Point at it.')
          : pick === data.fake ? (pl ? 'Brawo! Opiekun kiwa głową z uznaniem.' : 'Well done! The Keeper nods in approval.') : (pl ? `Nie ta. Fałszywa była moneta ${coinName(data.fake)}.` : `Not that one. The false coin was ${coinName(data.fake)}.`)}
      </p>
      <svg viewBox="0 0 200 90" className="pz-scale-art" aria-hidden="true">
        <path d="M100 20 V84 M80 84 H120" stroke="#c8a060" strokeWidth="4" />
        <motion.g animate={{ rotate: tilt * -10 }} style={{ originX: '100px', originY: '20px' }} transition={{ type: 'spring', stiffness: 80 }}>
          <path d="M30 20 H170" stroke="#e0b25c" strokeWidth="4" />
          <path d="M30 20 L18 52 H42 Z M170 20 L158 52 H182 Z" fill="none" stroke="#e0b25c" strokeWidth="2" />
          <text x="30" y="48" textAnchor="middle" fontSize="10" fill="#fff3d6">{(log[log.length - 1]?.left ?? []).map(coinName).join('')}</text>
          <text x="170" y="48" textAnchor="middle" fontSize="10" fill="#fff3d6">{(log[log.length - 1]?.right ?? []).map(coinName).join('')}</text>
        </motion.g>
      </svg>
      <div className="pz-coins">
        {side.map((s, i) => (
          <button key={i} className={`pz-coin ${s === 1 ? 'left' : s === 2 ? 'right' : ''} ${mode === 'end' && i === data.fake ? 'fake' : ''} ${pick === i ? 'picked' : ''}`} onClick={() => tap(i)} disabled={mode === 'end'}>
            {coinName(i)}<small>{s === 1 ? (pl ? 'L' : 'L') : s === 2 ? (pl ? 'P' : 'R') : ''}</small>
          </button>
        ))}
      </div>
      <ol className="pz-guesses">
        {log.map((w, i) => <li key={i}>{w.left.map(coinName).join('')} {w.tilt === -1 ? '⟍' : w.tilt === 1 ? '⟋' : '='} {w.right.map(coinName).join('')} <small>{w.tilt === -1 ? (pl ? 'lewa cięższa' : 'left heavier') : w.tilt === 1 ? (pl ? 'prawa cięższa' : 'right heavier') : (pl ? 'równowaga' : 'balanced')}</small></li>)}
      </ol>
      {mode === 'weigh' && (
        <div className="pz-hl-buttons">
          <button className="pz-go" onClick={weigh} disabled={left.length === 0 || left.length !== right.length}>{pl ? 'Ważę' : 'Weigh'}</button>
          <button className="pz-stop" onClick={() => { setSide(side.map(() => 0)); setMode('pick'); }}>{pl ? 'Już wiem' : 'I know it'}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Stars: the sign of your people ----------

export function Stars({ data, done }: Props<'stars'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [phase, setPhase] = useState<'show' | 'fade' | 'pick' | 'end'>('show');
  const [picked, setPicked] = useState<number[]>([]);
  const finish = useFinish(done);
  const need = new Set(data.target).size;
  useEffect(() => {
    if (phase === 'show') {
      const id = setTimeout(() => setPhase('fade'), wait(data.showMs));
      return () => clearTimeout(id);
    }
    if (phase === 'fade') {
      const id = setTimeout(() => setPhase('pick'), wait(700));
      return () => clearTimeout(id);
    }
  }, [phase, data.showMs]);
  const tap = (i: number) => {
    if (phase !== 'pick') return;
    const next = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i];
    puzzleSound(picked.includes(i) ? 'tick' : 'right');
    setPicked(next);
    if (next.length >= need) {
      setPhase('end');
      const score = starScore(data, next);
      puzzleSound(score === 2 ? 'win' : score ? 'right' : 'wrong');
      finish({ found: next }, 1700);
    }
  };
  const score = phase === 'end' ? starScore(data, picked) : 0;
  const line = data.target.map((i) => data.points[i]!).map(([x, y]) => `${x * 200},${y * 140}`).join(' ');
  return (
    <div className="pz pz-stars">
      <p className="pz-hint">
        {phase === 'show' ? (pl ? 'Zapamiętaj znak na niebie…' : 'Remember the sign in the sky…') : phase === 'fade' ? (pl ? 'Znak blednie…' : 'The sign fades…')
          : phase === 'pick' ? (pl ? `Wskaż gwiazdy znaku: ${picked.length}/${need}` : `Point to the sign's stars: ${picked.length}/${need}`)
          : score === 2 ? (pl ? 'Niebo rozbłyska! Widzisz drogę jak na dłoni.' : 'The sky flares! You see the way clearly.') : score === 1 ? (pl ? 'Prawie. Niebo pokazuje Ci okolicę.' : 'Nearly. The sky shows you the land around.') : (pl ? 'Gwiazdy milczą.' : 'The stars are silent.')}
      </p>
      <svg viewBox="0 0 200 140" className="pz-sky">
        <rect width="200" height="140" fill="#0b0b22" />
        {(phase === 'show' || phase === 'fade' || phase === 'end') && (
          <motion.polyline points={line} fill="none" stroke="#9fe8ff" strokeWidth="1.2" initial={{ opacity: 0 }} animate={{ opacity: phase === 'show' ? 0.9 : phase === 'end' ? 0.6 : 0 }} transition={{ duration: phase === 'fade' ? 0.5 : 0.4 }} />
        )}
        {data.points.map(([x, y], i) => {
          const on = picked.includes(i);
          const good = phase === 'end' && data.target.includes(i);
          return (
            <g key={i} onClick={() => tap(i)} style={{ cursor: phase === 'pick' ? 'pointer' : 'default' }}>
              <circle cx={x * 200} cy={y * 140} r="9" fill="transparent" />
              <circle cx={x * 200} cy={y * 140} r={on ? 3.6 : 2.4} fill={good ? '#7ee2a0' : on ? '#ffd166' : '#fff'} className="pz-star" style={{ animationDelay: `${(i % 7) * 0.3}s` }} />
              {phase === 'end' && on && !data.target.includes(i) && <circle cx={x * 200} cy={y * 140} r="6" fill="none" stroke="#ff8a7a" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- The Nomad's dice ----------

export function Bluff({ data, me, done }: Props<'bluff'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [round, setRound] = useState(0);
  const [verdicts, setVerdicts] = useState<('believe' | 'liar')[]>([]);
  const [shown, setShown] = useState(false);
  const finish = useFinish(done);
  const style = diceStyle(me.character.dice?.d6);
  const rounds = data.claims.length;
  const right = verdicts.filter((v, i) => (v === 'believe') === bluffTrue(data, i)).length;
  const call = (v: 'believe' | 'liar') => {
    if (shown || round >= rounds) return;
    const next = [...verdicts, v];
    setVerdicts(next);
    setShown(true);
    const ok = (v === 'believe') === bluffTrue(data, round);
    puzzleSound(ok ? 'right' : 'wrong');
    setTimeout(() => {
      setShown(false);
      if (round + 1 >= rounds) finish({ verdicts: next }, 300);
      else setRound(round + 1);
    }, wait(1700));
  };
  const [a, b] = data.rolls[Math.min(round, rounds - 1)]!;
  const claim = data.claims[Math.min(round, rounds - 1)]!;
  const last = verdicts[round];
  return (
    <div className="pz pz-bluff">
      <div className="pz-strikes">{data.claims.map((_, i) => <span key={i} className={i < verdicts.length ? ((verdicts[i] === 'believe') === bluffTrue(data, i) ? 'ok' : 'no') : i === round ? 'now' : ''}>◆</span>)}</div>
      <p className="pz-hint">{pl ? `Runda ${round + 1} z ${rounds} · trafienia: ${right}` : `Round ${round + 1} of ${rounds} · right calls: ${right}`}</p>
      <div className="pz-bluff-cup">
        {shown ? (
          <motion.div className="pz-dice-row" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <DieFace kind="d6" value={a} style={style} size={48} />
            <DieFace kind="d6" value={b} style={style} size={48} />
          </motion.div>
        ) : <span className="pz-cup" aria-hidden="true">🥤</span>}
      </div>
      <blockquote className="pz-verse">„{pl ? `Mam co najmniej ${claim} oczek.` : `I have at least ${claim} pips.`}”</blockquote>
      {!shown && data.tells[round] && <p className="pz-helper ok">✦ {pl ? 'Nomada nerwowo drapie się po brodzie…' : 'The Nomad scratches his beard nervously…'}</p>}
      {shown && <p className={`pz-verdict ${(last === 'believe') === bluffTrue(data, round) ? 'ok' : ''}`}>{pl ? `Wyrzucił ${a + b}. ${bluffTrue(data, round) ? 'Mówił prawdę.' : 'Kłamał!'}` : `He rolled ${a + b}. ${bluffTrue(data, round) ? 'He told the truth.' : 'He lied!'}`}</p>}
      {!shown && round < rounds && (
        <div className="pz-hl-buttons">
          <button className="pz-go" onClick={() => call('believe')}>{pl ? 'Wierzę' : 'I believe you'}</button>
          <button className="pz-go" onClick={() => call('liar')}>{pl ? 'Kłamiesz!' : 'Liar!'}</button>
        </div>
      )}
    </div>
  );
}

// ---------- Fireflies ----------

export function Catch({ data, done }: Props<'catch'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [phase, setPhase] = useState<'ready' | 'run' | 'end'>('ready');
  const [now, setNow] = useState(0);
  const [caught, setCaught] = useState<number[]>([]);
  const caughtRef = useRef<number[]>([]);
  const t0 = useRef(0);
  const finish = useFinish(done);
  useEffect(() => {
    if (phase === 'ready') {
      const id = setTimeout(() => { t0.current = performance.now(); setPhase('run'); }, wait(1200));
      return () => clearTimeout(id);
    }
    if (phase !== 'run') return;
    const id = setInterval(() => {
      const t = performance.now() - t0.current;
      setNow(t);
      if (t >= data.seconds * 1000) {
        clearInterval(id);
        setPhase('end');
        const n = caughtRef.current.length;
        puzzleSound(n >= 8 ? 'win' : n ? 'right' : 'wrong');
        finish({ hits: n }, 1200);
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase, data.seconds, finish]);
  const life = reduced() ? data.lifeMs * 1.5 : data.lifeMs;
  const tap = (i: number) => {
    if (phase !== 'run' || caught.includes(i)) return;
    puzzleSound('tick');
    caughtRef.current = [...caughtRef.current, i];
    setCaught(caughtRef.current);
  };
  return (
    <div className="pz pz-catch">
      <p className="pz-hint">{phase === 'ready' ? (pl ? 'Łap świetliki, zanim zgasną!' : 'Catch the fireflies before they fade!') : (pl ? `W słoiku: ${caught.length}` : `In the jar: ${caught.length}`)}</p>
      <Hourglass share={phase === 'ready' ? 1 : Math.max(0, 1 - now / (data.seconds * 1000))} left={phase === 'ready' ? data.seconds : Math.max(0, data.seconds - now / 1000)} />
      <div className="pz-meadow">
        {phase === 'run' && data.spawns.map((s, i) => {
          if (caught.includes(i) || now < s.at || now > s.at + life) return null;
          return (
            <motion.button key={i} className="pz-firefly" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} onPointerDown={() => tap(i)}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: [0.4, 1, 0.6], x: [0, 6, -4, 0], y: [0, -5, 3, 0] }} transition={{ duration: life / 1000 }} aria-label={pl ? 'Świetlik' : 'Firefly'} />
          );
        })}
        <span className="pz-jar" aria-hidden="true">{'✦'.repeat(Math.min(caught.length, 18))}</span>
      </div>
    </div>
  );
}

// ---------- The sliding fresco ----------

function Fresco({ view }: { view: string }) {
  return (
    <svg viewBox={view} preserveAspectRatio="none" aria-hidden="true">
      <rect width="90" height="90" fill="#d8c8a0" />
      <circle cx="45" cy="30" r="18" fill="#ffd166" stroke="#8a5a00" strokeWidth="1.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M45 6 V0" transform={`rotate(${a} 45 30)`} stroke="#c8801a" strokeWidth="2.5" />)}
      <path d="M0 70 L20 50 L35 62 L55 40 L75 58 L90 48 V90 H0 Z" fill="#5a7a9a" />
      <path d="M0 80 Q45 66 90 80 V90 H0 Z" fill="#3a5a3a" />
      <path d="M40 30 l5 -8 l5 8 l-5 8 z" fill="#c84a3a" />
      <rect x="1" y="1" width="88" height="88" fill="none" stroke="#6b4a24" strokeWidth="2" />
    </svg>
  );
}

export function Slider({ data, state, done }: Props<'slider'>) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const [tiles, setTiles] = useState(data.tiles);
  const [moves, setMoves] = useState<number[]>([]);
  const [over, setOver] = useState(false);
  const finish = useFinish(done);
  const end = (m: number[], ok: boolean) => {
    if (over) return;
    setOver(true);
    puzzleSound(ok ? 'win' : 'wrong');
    finish({ moves: m }, 1500);
  };
  const time = useCountdown(data.seconds, !over, () => end(moves, false));
  const tap = (cell: number) => {
    if (over) return;
    const next = slide(tiles, [cell]);
    if (next.every((x, i) => x === tiles[i])) return;
    puzzleSound('tick');
    const m = [...moves, cell];
    setTiles(next);
    setMoves(m);
    if (slid(next)) end(m, true);
  };
  const solved = slid(tiles);
  return (
    <div className="pz pz-slider">
      <HelperNote state={state} yes={pl ? 'Inteligencja: widzisz numery płytek.' : 'Intelligence: you can see the tile numbers.'} no={pl ? 'Płytki nie mają numerów.' : 'The tiles have no numbers.'} />
      <Hourglass {...time} />
      <p className="pz-hint">{over ? (solved ? (pl ? 'Fresk jest cały! W słońcu lśni runa.' : 'The fresco is whole! A rune gleams in the sun.') : (pl ? 'Czas minął. Płytki zastygają.' : 'Time is up. The tiles set fast.')) : (pl ? `Stuknij płytkę obok pustego pola. Ruchy: ${moves.length}` : `Tap a tile next to the gap. Moves: ${moves.length}`)}</p>
      <div className="pz-slide-grid">
        {tiles.map((tile, cell) => (
          <button key={cell} className={`pz-slide ${tile === 8 ? 'blank' : ''}`} onClick={() => tap(cell)} disabled={over || tile === 8}>
            {(tile !== 8 || solved) && <Fresco view={`${(tile % 3) * 30} ${Math.floor(tile / 3) * 30} 30 30`} />}
            {data.numbered && tile !== 8 && !solved && <b>{tile + 1}</b>}
          </button>
        ))}
      </div>
      <figure className="pz-slide-goal"><Fresco view="0 0 90 90" /><figcaption>{pl ? 'Wzór' : 'Goal'}</figcaption></figure>
    </div>
  );
}
