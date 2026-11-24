import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ENEMIES, ITEMS, type DiceLook } from '@hp/content';
import {
  attacksPerTurn, combatMoves, fightOdds, foeDamage, heroWeapon, strengthStep, successChance, testModifier, worldView,
  type Action, type GameState, type LogEntry, type PlayerState, type TestResult,
} from '@hp/engine';
import { useT, type UiKey } from '../i18n';
import { Icon } from '../Icons';
import { diceVars } from '../DiceFace';
import { HitFx, hitKind } from '../HitFx';
import { PixelFoe, PixelHero } from '../PixelHero';
import { cardName, combatLine, foeName, itemName } from '../logText';
import { SkillHand } from '../SkillCards';

/**
 * A fight shown one throw at a time. The player picks a move; an attack or a flight first shows
 * the test and the number to beat, and the dice roll only when the player taps the die. The engine
 * settles the whole round at once, then every throw of it is played back in order: the hero on the
 * left, the foes on the right, each roll and each blow on its own.
 */

type Step =
  | { kind: 'roll'; who: string; test: UiKey; result: TestResult; vs?: string; card?: string }
  | { kind: 'hit'; who: string; target: string; damage: number; location?: string; card?: string }
  | { kind: 'note'; who: string; text: string };

const HERO = 'hero';
const ROLL_MS = 1100;
const PAUSE_MS = 650;
/** How long each step of the foes' moves stays on screen, at normal pace; "faster" shortens it. */
const FOE_PAUSE_MS = 1500;
const PACE_KEY = 'hidden-paths.fightPace';
function readPace(): 'normal' | 'fast' {
  try {
    return localStorage.getItem(PACE_KEY) === 'fast' ? 'fast' : 'normal';
  } catch {
    return 'normal';
  }
}

function stepsOf(entries: LogEntry[], T: ReturnType<typeof useT>): Step[] {
  const { t, locale } = T;
  const pl = locale === 'pl';
  const out: Step[] = [];
  for (const e of entries) {
    if (e.type !== 'combat') continue;
    const ev = e.event;
    switch (ev.type) {
      case 'strike': {
        out.push({ kind: 'roll', who: ev.by, test: ev.by === HERO ? 'testCombat' : 'foeAttack', result: ev.result, vs: ev.target, card: ev.card });
        if (ev.parry) out.push({ kind: 'roll', who: HERO, test: 'parry', result: ev.parry, vs: ev.by });
        if (ev.dodge) out.push({ kind: 'roll', who: ev.target, test: 'foeDodge', result: ev.dodge });
        if (ev.barrier) out.push({ kind: 'roll', who: ev.by, test: 'foeBreak', result: ev.barrier });
        if (ev.parried) out.push({ kind: 'note', who: HERO, text: t('parried') });
        else if (ev.dodged) out.push({ kind: 'note', who: ev.target, text: pl ? 'Unik!' : 'Dodged!' });
        else if (ev.blocked) out.push({ kind: 'note', who: HERO, text: pl ? 'Bariera zatrzymuje cios!' : 'The barrier stops the blow!' });
        else if (ev.result.success && ev.damage !== undefined) out.push({ kind: 'hit', who: ev.by, target: ev.target, damage: ev.damage, location: ev.location, card: ev.card });
        break;
      }
      case 'flee':
        out.push({ kind: 'roll', who: HERO, test: 'testFlee', result: ev.hero });
        out.push({ kind: 'roll', who: 'foe', test: 'foeChase', result: ev.foe });
        out.push({ kind: 'note', who: HERO, text: ev.success ? t('fled') : `${t('flee')}: ${t('failure')}` });
        break;
      case 'focus': out.push({ kind: 'note', who: HERO, text: `${t('focus')}: +10` }); break;
      case 'stunned': out.push({ kind: 'note', who: ev.who, text: pl ? 'Ogłuszony!' : 'Stunned!' }); break;
      case 'drink': out.push({ kind: 'note', who: HERO, text: itemName(ev.item, locale) }); break;
      case 'reload': out.push({ kind: 'note', who: HERO, text: pl ? 'Ładujesz kuszę' : 'Reloading' }); break;
      case 'foeDown': out.push({ kind: 'note', who: ev.uid, text: pl ? 'Pokonany!' : 'Down!' }); break;
      case 'poisoned': out.push({ kind: 'note', who: ev.who, text: pl ? 'Trucizna!' : 'Poisoned!' }); break;
      case 'bleed': out.push({ kind: 'hit', who: 'venom', target: ev.uid, damage: ev.damage }); break;
      case 'trap':
        out.push({ kind: 'roll', who: ev.uid, test: 'foeTrap', result: ev.result });
        if (ev.damage) out.push({ kind: 'hit', who: 'trap', target: ev.uid, damage: ev.damage });
        if (!ev.result.success) out.push({ kind: 'note', who: ev.uid, text: pl ? 'Unieruchomiony na rundę!' : 'Held fast for a round!' });
        break;
      case 'barrier':
        out.push({ kind: 'roll', who: HERO, test: 'testIntBarrier', result: ev.result, card: 'mystic-barrier' });
        out.push({ kind: 'note', who: HERO, text: ev.result.success ? (pl ? 'Bariera stoi!' : 'The barrier stands!') : (pl ? 'Bariera się rozpada' : 'The barrier fails') });
        break;
      case 'card': out.push({ kind: 'note', who: HERO, text: combatLine(e, T) ?? cardName(ev.card, locale) }); break;
    }
  }
  return out;
}

export function Duel({ game, me, entries, act, onReplayDone }: {
  game: GameState;
  me: PlayerState;
  /** The throws of the round just played; null while the player chooses a move. */
  entries: LogEntry[] | null;
  act: (a: Action) => void;
  onReplayDone: () => void;
}) {
  const T = useT();
  const { t, locale } = T;
  const combat = me.combat!;
  const c = me.character;
  const world = worldView(game);
  const alive = combat.foes.filter((f) => f.vitality > 0);
  const [target, setTarget] = useState<string | null>(null);
  // With several foes the player picks whom to strike; a lone foe is the target by itself.
  const chosen = alive.find((f) => f.uid === target) ?? (alive.length === 1 ? alive[0] : undefined);
  const [pace, setPace] = useState(readPace);
  const togglePace = () => {
    const next = pace === 'fast' ? 'normal' : 'fast';
    setPace(next);
    try { localStorage.setItem(PACE_KEY, next); } catch { /* ignore */ }
  };
  /** The throw waiting for the player's tap: an attack, a flight, or a card that tests (Heavy Swing, Barrier...). */
  const [prompt, setPrompt] = useState<'attack' | 'flee' | { card: string } | null>(null);

  // Playback of the round: which step is showing and whether its die has landed.
  const steps = useMemo(() => (entries ? stepsOf(entries, T) : []), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const [at, setAt] = useState(0);
  const [rolled, setRolled] = useState(false);
  useEffect(() => {
    setAt(0);
    setRolled(false);
  }, [entries]);
  const step = entries ? steps[at] : undefined;
  // The tap that chose the move throws the first die; every later throw of the hero waits for its own tap.
  const waitingForTap = step?.kind === 'roll' && step.who === HERO && at > 0 && !rolled;

  useEffect(() => {
    if (!entries) return;
    if (at >= steps.length) {
      const done = setTimeout(onReplayDone, 500);
      return () => clearTimeout(done);
    }
    if (waitingForTap) return;
    if (step?.kind === 'roll' && !rolled) {
      setRolled(true);
      return;
    }
    // The foes' moves play slowly enough to follow; the player can speed them up.
    const foeStep = !!step && step.who !== HERO;
    const base = step?.kind === 'roll' ? ROLL_MS + (foeStep ? FOE_PAUSE_MS : PAUSE_MS) : step?.kind === 'hit' ? (foeStep ? 1500 : 1100) : (foeStep ? 1300 : 900);
    const wait = pace === 'fast' ? Math.round(base * 0.45) : base;
    const next = setTimeout(() => { setAt((i) => i + 1); setRolled(false); }, wait);
    return () => clearTimeout(next);
  }, [entries, at, steps.length, step, rolled, waitingForTap, onReplayDone, pace]);

  // Vitality as it stands at this point of the playback.
  const lost = (who: string) => steps.slice(0, entries ? at + (step?.kind === 'hit' ? 1 : 0) : 0)
    .reduce((sum, s) => sum + (s.kind === 'hit' && s.target === who ? s.damage : 0), 0);
  const heroVit = Math.max(0, c.vitality - lost(HERO));

  const odds = useMemo(() => fightOdds(world, me, combat), [combat.turn, c.vitality, alive.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const oddsPct = Math.round(odds.win * 100);
  const focus = combat.focus ? 10 : 0;
  const hitTarget = chosen ? Math.max(1, Math.min(99, c.attributes.com + testModifier(world, me, 'com', focus + (c.equipment.rune === 'precise' ? 5 : 0), ENEMIES[chosen.enemy]!.kind))) : 0;
  const fleeTarget = Math.round(successChance(c.attributes.dex, testModifier(world, me, 'dex', focus)) * 100);
  const barrierTarget = Math.round(successChance(c.attributes.int, testModifier(world, me, 'int', focus)) * 100);
  const cardMoves = combatMoves(me, combat).flatMap((m) => (m.move === 'card' ? [m.card] : []));
  const playCard = (card: string) => {
    if (card === 'warrior-rations' || card === 'wraith-leaves' || card === 'trapper-trap') act({ type: 'combat', move: { move: 'card', card } });
    else setPrompt({ card });
  };
  const promptTest: UiKey = prompt === 'flee' ? 'testFlee' : typeof prompt === 'object' && prompt?.card === 'mystic-barrier' ? 'testIntBarrier' : 'testCombat';
  const promptTarget = prompt === 'flee' ? fleeTarget
    : typeof prompt === 'object' && prompt ? (prompt.card === 'mystic-barrier' ? barrierTarget : Math.max(1, hitTarget - (prompt.card === 'warrior-heavy-swing' ? 10 : 0)))
    : hitTarget;
  const promptCard = typeof prompt === 'object' && prompt ? prompt.card : undefined;
  const weapon = heroWeapon(me);
  const potions = [...new Set(me.inventory.items.filter((i) => ITEMS[i]?.kind === 'potion'))];
  const busy = !!entries;
  const active = step?.who;
  const hitFx = step?.kind === 'hit'
    ? hitKind(step.who, combat.foes.find((f) => f.uid === step.who)?.enemy, { weaponId: weapon.id, weaponName: weapon.name.en, ranged: !!weapon.ranged }, step.card)
    : null;

  const throwDie = () => {
    if (prompt === 'attack' && chosen) act({ type: 'combat', move: { move: 'attack', target: chosen.uid } });
    if (prompt === 'flee') act({ type: 'combat', move: { move: 'flee' } });
    if (typeof prompt === 'object' && prompt) act({ type: 'combat', move: { move: 'card', card: prompt.card, ...(chosen ? { target: chosen.uid } : {}) } });
    setPrompt(null);
  };

  return (
    <div className="overlay combat">
      <motion.section className="arena duel" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
        <header className="card-head duel-head">
          <div>
            <small>{t('round')} {combat.turn}</small>
            <h2>{t('fight')}</h2>
          </div>
          <button className={`ghost small pace ${pace === 'fast' ? 'on' : ''}`} onClick={togglePace} aria-pressed={pace === 'fast'}>
            {pace === 'fast' ? '▶▶' : '▶'} {pace === 'fast' ? (locale === 'pl' ? 'Szybko' : 'Fast') : (locale === 'pl' ? 'Przyspiesz' : 'Speed up')}
          </button>
        </header>

        <div className="duel-field">
          <div className={`side hero-side ${active === HERO ? 'active' : ''}`}>
            <motion.div className="avatar" animate={step?.kind === 'hit' && step.target === HERO ? { x: [0, -10, 8, -4, 0] } : { x: 0 }}>
              <PixelHero race={c.race} profession={c.profession} look={c.look} size={72} />
            </motion.div>
            <b>{c.name}</b>
            <span className="bar hero-bar"><motion.span animate={{ width: `${(heroVit / c.maxVitality) * 100}%` }} /></span>
            <small><Icon name="vitality" size={12} /> {heroVit}/{c.maxVitality}</small>
            <small><Icon name="sword" size={12} /> {itemName(weapon.id, locale)} S{signed(strengthStep(c.attributes.str) + weapon.power)}+k6</small>
            {hitFx && step?.kind === 'hit' && step.target === HERO && <HitFx key={`fx-${at}`} kind={hitFx} />}
            <AnimatePresence>{step?.kind === 'hit' && step.target === HERO && <DamagePop key={at} damage={step.damage} location={step.location} />}</AnimatePresence>
          </div>

          <div className={`duel-centre ${busy || prompt ? '' : 'empty'}`}>
            <AnimatePresence mode="wait">
              {step?.kind === 'roll' && (
                <motion.div key={`roll-${at}`} className={`throw ${step.who === HERO ? 'mine' : 'theirs'}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <TestTitle test={step.test} target={step.result.target} who={`${step.who === HERO ? c.name : step.who === 'foe' ? t('foe') : foeName(step.who, locale)}${step.card ? ` · ${cardName(step.card, locale)}` : ''}`} />
                  <BigDie dice={c.dice} result={step.result} rolling={rolled} onTap={waitingForTap ? () => setRolled(true) : undefined} />
                </motion.div>
              )}
              {step?.kind === 'note' && (
                <motion.p key={`note-${at}`} className="duel-note" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{step.text}</motion.p>
              )}
              {!busy && prompt && (
                <motion.div key="prompt" className="throw mine" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <TestTitle test={promptTest} target={promptTarget} who={`${c.name}${promptCard ? ` · ${cardName(promptCard, locale)}` : ''}`} />
                  <BigDie dice={c.dice} onTap={throwDie} />
                  <button className="ghost small" onClick={() => setPrompt(null)}>{t('back')}</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="side foe-side">
            {combat.foes.map((f) => {
              const enemy = ENEMIES[f.enemy]!;
              const vit = Math.max(0, f.vitality - lost(f.uid));
              const down = vit <= 0;
              return (
                <motion.button
                  key={f.uid}
                  className={`foe-card ${chosen?.uid === f.uid ? 'chosen' : ''} ${active === f.uid ? 'active attacking' : ''} ${down ? 'down' : ''} ${!busy && !chosen && !down ? 'pickable' : ''}`}
                  disabled={down || busy}
                  onClick={() => setTarget(f.uid)}
                  animate={down ? { opacity: 0.3, scale: 0.9 } : step?.kind === 'hit' && step.target === f.uid ? { x: [0, 10, -8, 4, 0] } : { opacity: 1, scale: 1, x: 0 }}
                >
                  {active === f.uid && !down && <span className="foe-flag attack">{locale === 'pl' ? 'Atakuje!' : 'Attacking!'}</span>}
                  {chosen?.uid === f.uid && !down && active !== f.uid && alive.length > 1 && <span className="foe-flag target">◎ {locale === 'pl' ? 'Twój cel' : 'Your target'}</span>}
                  <PixelFoe kind={enemy.kind} size={combat.foes.length > 1 ? 48 : 72} />
                  <b>{foeName(f.uid, locale)}</b>
                  <span className="bar"><motion.span animate={{ width: `${(vit / f.maxVitality) * 100}%` }} /></span>
                  <small><Icon name="vitality" size={12} /> {vit}/{f.maxVitality} · {t('com')} {enemy.com} · {t('foeHits')} {foeDamage(f.enemy).join('–')}</small>
                  {hitFx && step?.kind === 'hit' && step.target === f.uid && <HitFx key={`fx-${at}`} kind={hitFx} />}
                  <AnimatePresence>{step?.kind === 'hit' && step.target === f.uid && <DamagePop key={at} damage={step.damage} location={step.location} />}</AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>

        {!busy && !prompt && (
          <>
            {!chosen && alive.length > 1 && <p className="duel-hint pick-hint">{locale === 'pl' ? 'Wybierz przeciwnika, którego chcesz zaatakować.' : 'Pick the foe you want to strike.'}</p>}
            <p className={`odds ${oddsPct < 50 ? 'grim' : ''}`}>
              {t('winOdds')} ~{oddsPct}%{oddsPct < 50 ? ` · ${t('fleeHint')}` : ''} · {attacksPerTurn(me)} {t('attacksPerTurn')}
            </p>
            <div className="combat-moves">
              <button className="primary with-icon" disabled={!chosen} onClick={() => setPrompt('attack')}><Icon name="sword" />{t('attack')}</button>
              <button className="ghost with-icon" onClick={() => act({ type: 'combat', move: { move: 'parry' } })}><Icon name="shield" />{t('parry')}</button>
              <button className="ghost" onClick={() => act({ type: 'combat', move: { move: 'focus' } })}>{t('focus')}</button>
              <button className="ghost" onClick={() => setPrompt('flee')}>{t('flee')}</button>
              {potions.map((p) => (
                <button key={p} className="ghost small" onClick={() => act({ type: 'combat', move: { move: 'potion', item: p } })}>{itemName(p, locale)}</button>
              ))}
            </div>
            <SkillHand profession={c.profession} owned={c.cards} actor={me} playable={cardMoves} onPlay={playCard} inFight compact />
          </>
        )}
        {busy && <p className="duel-hint">{waitingForTap ? t('tapDie') : ' '}</p>}
      </motion.section>
    </div>
  );
}

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

/** "Combat test" with the number to roll at or under on a shield. */
function TestTitle({ test, target, who }: { test: UiKey; target: number; who: string }) {
  const { t } = useT();
  return (
    <div className="test-title">
      <small>{who}</small>
      <b>{t(test)}</b>
      <span className="target-shield" title={t('rollUnder')}>
        <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 L37 8 V22 C37 34 29 41 20 44 C11 41 3 34 3 22 V8 Z" /></svg>
        <span>{target}</span>
      </span>
      <small>{t('rollUnder')}</small>
    </div>
  );
}

/** A big d100 die. Before the throw it waits for a tap; then it tumbles and lands on the result. */
/** The k100 throw: a k100 die for the tens and a k10 for the units, in the hero's own dice colours. */
function BigDie({ result, rolling = false, onTap, dice }: { result?: TestResult; rolling?: boolean; onTap?: () => void; dice?: DiceLook }) {
  const { t } = useT();
  const [face, setFace] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!rolling || !result) {
      setFace(null);
      setLanded(false);
      return;
    }
    let alive = true;
    let wait = 35;
    let timer: ReturnType<typeof setTimeout>;
    const start = performance.now();
    const tick = () => {
      if (!alive) return;
      if (performance.now() - start > ROLL_MS - 100) {
        setFace(result.roll);
        setLanded(true);
        return;
      }
      setFace(1 + Math.floor(Math.random() * 100));
      wait *= 1.17;
      timer = setTimeout(tick, wait);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rolling, result]);

  // 100 shows as "00" on the tens die and "0" on the units die.
  const tens = face === null ? '?' : face === 100 ? '00' : String(Math.floor(face / 10) * 10).padStart(2, '0');
  const units = face === null ? '?' : String(face % 10);
  const spin = rolling && !landed;
  return (
    <div className="big-die-wrap">
      <motion.button
        className={`big-die ${onTap ? 'ready' : ''} ${landed ? (result!.success ? 'ok' : 'bad') : ''}`}
        disabled={!onTap}
        onClick={onTap}
        animate={onTap ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={onTap ? { duration: 1.1, repeat: Infinity } : { duration: 0.2 }}
        aria-label={onTap ? t('roll') : face === null ? 'k100' : String(face)}
      >
        <span className="big-die-pair">
          {[{ text: tens, die: 'd100' as const, d: 0 }, { text: units, die: 'd10' as const, d: 0.08 }].map((x) => (
            <motion.span
              key={x.die}
              className={`die big ${x.die === 'd100' ? 'tens' : ''}`}
              style={diceVars(dice, x.die)}
              animate={spin ? { rotate: [0, 200, 340, 380, 360], y: [0, -40, 0, -14, 0] } : { rotate: 0, y: 0 }}
              transition={spin ? { duration: ROLL_MS / 1000, ease: 'easeOut', delay: x.d } : { duration: 0.2 }}
            >
              {x.text}
            </motion.span>
          ))}
        </span>
        <small>{onTap ? t('roll') : 'k100 + k10'}</small>
      </motion.button>
      <AnimatePresence>
        {landed && result && (
          <motion.b className={`dice-verdict ${result.success ? 'ok' : 'bad'}`} initial={{ scale: 1.8, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} transition={{ type: 'spring', stiffness: 420, damping: 14 }}>
            {result.roll} / {result.target} · {result.success ? t('success') : t('failure')}
          </motion.b>
        )}
      </AnimatePresence>
    </div>
  );
}

function DamagePop({ damage, location }: { damage: number; location?: string }) {
  const { t } = useT();
  return (
    <motion.span className="damage-pop" initial={{ y: 0, opacity: 0, scale: 0.6 }} animate={{ y: -34, opacity: 1, scale: 1.2 }} exit={{ opacity: 0, y: -50 }} transition={{ duration: 0.45 }}>
      −{damage}{location ? <small> {t(location as UiKey)}</small> : null}
    </motion.span>
  );
}
