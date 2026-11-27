import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ENEMIES, ITEMS, type ArmourSlot, type DiceLook } from '@hp/content';
import {
  attacksPerTurn, canDisarm, canMaster, canTame, combatMoves, MASTER_STEPS, fightOdds, magicBonus, foeDamage, heroArmour, heroWeapon, strengthStep, successChance, testModifier, worldView,
  type Action, type GameState, type LogEntry, type PlayerState, type TestResult,
} from '@hp/engine';
import { useT, type UiKey } from '../i18n';
import { Icon } from '../Icons';
import { diceStyle, diceVars, DieFace } from '../DiceFace';
import { spotName } from '../ArmourBody';
import { FoeFigure, HeroFigure } from '../ArmouredFigure';
import { buzz, clack, ShakeToThrow, Verdict } from '../Throw';
import { HitFx, hitKind } from '../HitFx';
import { hurtSound } from '../Feedback';
import { FoeArt } from '../HeroArt';
import { cardName, combatLine, foeName, itemName } from '../logText';
import { SkillHand } from '../SkillCards';
import { foeStatuses, heroStatuses, StatusChips, StatusDetail, StatusFigure, type LiveFlags } from '../CombatStatus';

/**
 * A fight shown one throw at a time. The player picks a move; an attack or a flight first shows
 * the test and the number to beat, and the dice roll only when the player taps the die. The engine
 * settles the whole round at once, then every throw of it is played back in order: the hero on the
 * left, the foes on the right, each roll and each blow on its own.
 */

/** A hero-wide state a step turns on or off (`off` counts from the step after), for the statuses during playback. */
type Fx = { on?: string; off?: string };

type Step = (
  | { kind: 'roll'; who: string; test: UiKey; result: TestResult; vs?: string; card?: string }
  | { kind: 'hit'; who: string; target: string; damage: number; location?: ArmourSlot; roll?: number; damageRoll?: number; armour?: number; card?: string }
  /** Where a blow lands: the k6 for the spot, or the striker's own pick after a hit by more than 20. */
  | { kind: 'spot'; who: string; target: string; slot: ArmourSlot; roll?: number; margin: number }
  | { kind: 'note'; who: string; text: string }
) & { fx?: Fx };

const HERO = 'hero';
/** Cards that act at once in a fight, with no throw for the player to make. */
const INSTANT = ['warrior-rations', 'wraith-leaves', 'trapper-trap', 'guardian-stance', 'elder-herb', 'explorer-bandages', 'runemaster-empower', 'warrior-strategist', 'wraith-mist', 'cavedelver-blind'];
/** Combat penalty of the attacking cards, shown on the shield before the throw. */
const CARD_HIT: Record<string, number> = { 'warrior-heavy-swing': -10, 'diver-fillet': -10, 'druid-fangs': -20 };
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
  /** The last foe's test against a sprung trap: the trap is gone after it. */
  let lastTrap = -1;
  for (const e of entries) {
    if (e.type !== 'combat') continue;
    const ev = e.event;
    switch (ev.type) {
      case 'strike': {
        const test: UiKey = ev.by.startsWith('pet-') ? 'companionAttack' : ev.by !== HERO ? 'foeAttack' : ev.card === 'guardian-riposte' ? 'testRiposte' : ev.scroll ? 'testScroll' : 'testCombat';
        out.push({ kind: 'roll', who: ev.by, test, result: ev.result, vs: ev.target, card: ev.by === HERO ? ev.card ?? ev.scroll : undefined });
        if (ev.parry) out.push({ kind: 'roll', who: HERO, test: 'parry', result: ev.parry, vs: ev.by });
        if (ev.dodge) out.push({ kind: 'roll', who: ev.target, test: 'foeDodge', result: ev.dodge });
        if (ev.barrier) out.push({ kind: 'roll', who: ev.by, test: 'foeBreak', result: ev.barrier, fx: { off: 'barrier' } });
        if (ev.parried) out.push({ kind: 'note', who: HERO, text: t('parried') });
        else if (ev.dodged) out.push({ kind: 'note', who: ev.target, text: pl ? 'Unik!' : 'Dodged!' });
        else if (ev.blocked && ev.card === 'guardian-stance') out.push({ kind: 'note', who: HERO, text: pl ? 'Tarcza blokuje cios!' : 'The shield blocks the blow!' });
        else if (ev.blocked) out.push({ kind: 'note', who: HERO, text: pl ? 'Bariera zatrzymuje cios!' : 'The barrier stops the blow!' });
        else if (ev.result.success && ev.damage !== undefined) {
          if (ev.location) out.push({ kind: 'spot', who: ev.by, target: ev.target, slot: ev.location, roll: ev.locationRoll, margin: ev.result.margin });
          out.push({ kind: 'hit', who: ev.by, target: ev.target, damage: ev.damage, location: ev.location, roll: ev.locationRoll, damageRoll: ev.damageRoll, armour: ev.armour, card: ev.card ?? ev.scroll });
        }
        break;
      }
      case 'flee':
        out.push({ kind: 'roll', who: HERO, test: 'testFlee', result: ev.hero, card: ev.card });
        if (ev.foe) out.push({ kind: 'roll', who: 'foe', test: 'foeChase', result: ev.foe });
        out.push({ kind: 'note', who: HERO, text: ev.success ? t('fled') : `${t('flee')}: ${t('failure')}` });
        break;
      case 'focus': out.push({ kind: 'note', who: HERO, text: `${t('focus')}: +10`, fx: { on: 'focus' } }); break;
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
        lastTrap = out.length - 1;
        break;
      case 'barrier':
        out.push({ kind: 'roll', who: HERO, test: 'testIntBarrier', result: ev.result, card: 'mystic-barrier' });
        out.push({ kind: 'note', who: HERO, text: ev.result.success ? (pl ? 'Bariera stoi!' : 'The barrier stands!') : (pl ? 'Bariera się rozpada' : 'The barrier fails'), ...(ev.result.success ? { fx: { on: 'barrier' } } : {}) });
        break;
      case 'card': {
        const on = ev.card === 'trapper-trap' ? 'trap' : ev.card === 'wraith-mist' ? 'mist' : undefined;
        out.push({ kind: 'note', who: HERO, text: combatLine(e, T) ?? cardName(ev.card, locale), ...(on ? { fx: { on } } : {}) });
        break;
      }
      case 'stance': out.push({ kind: 'note', who: HERO, text: pl ? 'Postawa obronna: blokujesz ciosy tej rundy' : 'Defensive stance: you block this round\'s blows' }); break;
      case 'disarm':
        out.push({ kind: 'roll', who: ev.uid, test: 'foeKeepWeapon', result: ev.result });
        out.push({ kind: 'note', who: ev.uid, text: ev.kept ? (pl ? 'Utrzymuje broń' : 'Keeps its weapon') : (pl ? 'Traci broń!' : 'Loses its weapon!') });
        break;
      case 'rearm':
        out.push({ kind: 'roll', who: ev.uid, test: 'foeRearm', result: ev.foe });
        out.push({ kind: 'roll', who: HERO, test: 'heroHoldWeapon', result: ev.hero });
        out.push({ kind: 'note', who: ev.uid, text: ev.success ? (pl ? 'Odzyskuje broń!' : 'Gets its weapon back!') : (pl ? 'Wciąż bez broni' : 'Still unarmed') });
        break;
      case 'tame':
        out.push({ kind: 'roll', who: HERO, test: 'testChaTame', result: ev.result, card: 'druid-companion' });
        out.push({ kind: 'note', who: ev.uid, text: ev.result.success ? (pl ? 'Oswojony! Walczy po Twojej stronie' : 'Tamed! It fights on your side') : (pl ? 'Nie daje się oswoić' : 'Will not be tamed') });
        break;
      case 'scroll': out.push({ kind: 'note', who: HERO, text: combatLine(e, T) ?? itemName(ev.item, locale) }); break;
      case 'burn':
        out.push({ kind: 'roll', who: ev.uid, test: 'foeBurn', result: ev.result });
        out.push({ kind: 'hit', who: 'fire', target: ev.uid, damage: ev.damage });
        out.push({ kind: 'note', who: ev.uid, text: ev.dead ? (pl ? 'Spłonął!' : 'Burnt to death!') : ev.out ? (pl ? 'Gasi ogień' : 'Puts the fire out') : (pl ? 'Płonie!' : 'Burning!') });
        break;
      case 'shock':
        out.push({ kind: 'roll', who: ev.uid, test: 'foeShock', result: ev.result });
        out.push({ kind: 'note', who: ev.uid, text: ev.stunned ? (pl ? 'Ogłuszony!' : 'Stunned!') : (pl ? 'Otrząsa się' : 'Shrugs it off') });
        break;
      case 'wound':
        if (ev.result) {
          out.push({ kind: 'roll', who: ev.uid, test: 'foeStaunch', result: ev.result });
          out.push({ kind: 'note', who: ev.uid, text: ev.staunched ? (pl ? 'Tamuje ranę' : 'Staunches the wound') : (pl ? 'Krew wciąż płynie' : 'Still bleeding') });
        } else {
          out.push({ kind: 'hit', who: 'venom', target: ev.uid, damage: ev.damage ?? 1 });
          if (ev.dead) out.push({ kind: 'note', who: ev.uid, text: pl ? 'Wykrwawia się!' : 'Bleeds out!' });
        }
        break;
      case 'vines':
        if (ev.by === 'hero') out.push({ kind: 'roll', who: HERO, test: 'testIntVines', result: ev.result, card: 'mystic-vines' });
        else out.push({ kind: 'roll', who: ev.uid, test: 'foeTearFree', result: ev.result });
        out.push({ kind: 'note', who: ev.uid, text: ev.bound ? (pl ? 'Oplątany pnączami!' : 'Bound by vines!') : ev.by === 'hero' ? (pl ? 'Pnącza nie chwytają' : 'The vines miss') : (pl ? 'Zrywa pnącza' : 'Tears free') });
        break;
      case 'master':
        out.push({ kind: 'roll', who: HERO, test: 'testChaMaster', result: ev.result, card: 'elder-beast-master' });
        out.push({ kind: 'note', who: ev.uid, text: ev.companion ? (pl ? 'Bestia zostaje z tobą na zawsze!' : 'The beast stays with you for good!') : ev.result.success ? (pl ? `Bestia słucha (${ev.step}/3)` : `The beast obeys (${ev.step}/3)`) : (pl ? 'Bestia się wyrywa' : 'The beast breaks free') });
        break;
      case 'hide':
        out.push({ kind: 'roll', who: HERO, test: 'testDexHide', result: ev.hero, card: 'diver-camouflage' });
        for (const f of ev.foes) out.push({ kind: 'roll', who: f.uid, test: 'foeSpot', result: f.result });
        out.push({ kind: 'note', who: HERO, text: ev.hidden ? t('hidden') : (pl ? 'Zauważony!' : 'Spotted!') });
        break;
      case 'blind':
        for (const f of ev.foes) {
          out.push({ kind: 'roll', who: f.uid, test: 'foeBlind', result: f.result });
          if (!f.result.success) out.push({ kind: 'note', who: f.uid, text: pl ? 'Oślepiony! −30' : 'Blinded! −30' });
        }
        break;
      case 'tear':
        out.push({ kind: 'roll', who: HERO, test: 'testStrTear', result: ev.hero, card: 'druid-fangs' });
        out.push({ kind: 'roll', who: ev.uid, test: 'foeStrTear', result: ev.foe });
        if (ev.torn) out.push({ kind: 'note', who: ev.uid, text: pl ? 'Rozdarcie! +4' : 'Torn open! +4' });
        break;
      case 'held': out.push({ kind: 'note', who: ev.uid, text: pl ? 'Walczy po twojej stronie!' : 'Fights on your side!' }); break;
      case 'companionDown': out.push({ kind: 'note', who: ev.uid, text: pl ? 'Towarzysz pada!' : 'Your companion falls!' }); break;
    }
  }
  if (lastTrap >= 0) out[lastTrap] = { ...out[lastTrap]!, fx: { ...out[lastTrap]!.fx, off: 'trap' } };
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
  /** The spot the hero goes for; it counts when the Combat test passes by more than 20. Null: the weakest spot. */
  const [aim, setAim] = useState<ArmourSlot | null>(null);
  // With several foes the player picks whom to strike; a lone foe is the target by itself.
  const chosen = alive.find((f) => f.uid === target) ?? (alive.length === 1 ? alive[0] : undefined);
  const [pace, setPace] = useState(readPace);
  const togglePace = () => {
    const next = pace === 'fast' ? 'normal' : 'fast';
    setPace(next);
    try { localStorage.setItem(PACE_KEY, next); } catch { /* ignore */ }
  };
  /** The throw waiting for the player's tap: an attack, a flight, or a card that tests (Heavy Swing, Barrier...). */
  /** The buff or debuff opened in words, as "owner:key". */
  const [openFx, setOpenFx] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<'attack' | 'flee' | { card: string } | { scroll: string } | null>(null);

  // Playback of the round: which step is showing and whether its die has landed.
  const steps = useMemo(() => (entries ? stepsOf(entries, T) : []), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const [at, setAt] = useState(0);
  const [rolled, setRolled] = useState(false);
  useEffect(() => {
    setAt(0);
    setRolled(false);
  }, [entries]);
  const step = entries ? steps[at] : undefined;
  // A blow on the hero is felt too: a thump, a shudder and a red flash at the edges.
  const heroHurt = step?.kind === 'hit' && step.target === HERO && step.damage > 0;
  useEffect(() => {
    if (heroHurt && step?.kind === 'hit') hurtSound(step.damage >= 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, heroHurt]);
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
    const base = step?.kind === 'roll' ? ROLL_MS + (foeStep ? FOE_PAUSE_MS : PAUSE_MS) : step?.kind === 'hit' ? (foeStep ? 1500 : 1300) : step?.kind === 'spot' ? (foeStep ? 1400 : 1200) : (foeStep ? 1300 : 900);
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
  const moves = combatMoves(me, combat);
  const cardMoves = moves.flatMap((m) => (m.move === 'card' ? [m.card] : []));
  const playCard = (card: string) => {
    if (INSTANT.includes(card)) act({ type: 'combat', move: { move: 'card', card, ...(card === 'warrior-strategist' ? { target: (chosen ?? alive[0])?.uid } : {}) } });
    else setPrompt({ card });
  };
  const promptCard = typeof prompt === 'object' && prompt && 'card' in prompt ? prompt.card : undefined;
  const promptScroll = typeof prompt === 'object' && prompt && 'scroll' in prompt ? prompt.scroll : undefined;
  const scrollMoves = moves.flatMap((m) => (m.move === 'scroll' ? [m] : []));
  // Disarm and Companion work only on some foes: the chosen one if it fits, otherwise the first that does.
  const fits = (card: string, f: (typeof alive)[number]) => (card === 'explorer-disarm' ? canDisarm(f) : card === 'druid-companion' ? canTame(me, f)
    : card === 'elder-beast-master' ? canMaster(me, f) : card === 'mystic-vines' ? !f.vined : true);
  const cardFoe = promptCard && chosen && fits(promptCard, chosen) ? chosen
    : promptCard ? alive.find((f) => f.uid === (moves.find((m) => m.move === 'card' && m.card === promptCard) as { target?: string } | undefined)?.target) ?? chosen
    : chosen;
  const hitOn = (f: typeof chosen) => (f ? Math.max(1, Math.min(99, c.attributes.com + testModifier(world, me, 'com', focus + (c.equipment.rune === 'precise' ? 5 : 0), ENEMIES[f.enemy]!.kind))) : 0);
  const tameTarget = Math.round(successChance(c.attributes.cha, testModifier(world, me, 'cha', focus)) * 100);
  const chance = (attr: 'dex' | 'int' | 'cha', extra = 0) => Math.round(successChance(c.attributes[attr], testModifier(world, me, attr, focus + extra)) * 100);
  const guardian = c.cards.includes('guardian-vigilance') ? 10 : 0;
  /** The throw and the number to beat for each card that tests something other than a plain blow. */
  const CARD_TEST: Record<string, [UiKey, number]> = {
    'mystic-barrier': ['testIntBarrier', barrierTarget],
    'druid-companion': ['testChaTame', tameTarget],
    'elder-beast-master': ['testChaMaster', chance('cha', MASTER_STEPS[cardFoe?.controlled ?? 0] ?? 0)],
    'diver-camouflage': ['testDexHide', chance('dex')],
    'explorer-smoke': ['testFlee', chance('dex', guardian)],
    'mystic-vines': ['testIntVines', chance('int')],
  };
  const cardTest = promptCard ? CARD_TEST[promptCard] : undefined;
  const promptTest: UiKey = prompt === 'flee' ? 'testFlee' : promptScroll ? 'testScroll' : cardTest ? cardTest[0] : 'testCombat';
  const promptTarget = prompt === 'flee' ? fleeTarget
    : promptScroll ? Math.max(1, Math.min(99, c.attributes.com + testModifier(world, me, 'com', focus + magicBonus(world, me), ENEMIES[(chosen ?? alive[0])?.enemy ?? 'wolf']!.kind)))
    : cardTest ? cardTest[1]
    : promptCard ? Math.max(1, hitOn(cardFoe) + (CARD_HIT[promptCard] ?? 0))
    : hitTarget;
  const pets = me.companions ?? [];
  const weapon = heroWeapon(me);
  const potions = [...new Set(me.inventory.items.filter((i) => ITEMS[i]?.kind === 'potion'))];
  const busy = !!entries;
  const active = step?.who;
  const strike = weaponStrike(weapon.id, locale);
  // The hero's own blow: a lunge with a blade or axe, an arrow or bolt flying across with a bow.
  const heroBlow = step?.kind === 'hit' && step.who === HERO && !step.card?.startsWith('trapper-trap') ? (weapon.ranged || step.card?.startsWith('scroll') ? 'ranged' : 'melee') : null;
  const hitFx = step?.kind === 'hit'
    ? hitKind(step.who, combat.foes.find((f) => f.uid === step.who)?.enemy, { weaponId: weapon.id, weaponName: weapon.name.en, ranged: !!weapon.ranged }, step.card)
    : null;
  const petFx = step?.kind === 'hit' && step.who.startsWith('pet-')
    ? hitKind('pet', pets.find((p) => p.uid === step.who)?.enemy, { weaponId: weapon.id, weaponName: weapon.name.en, ranged: !!weapon.ranged })
    : null;

  const aimed = aim ? { aim } : {};
  const throwDie = () => {
    if (prompt === 'attack' && chosen) act({ type: 'combat', move: { move: 'attack', target: chosen.uid, ...aimed } });
    if (prompt === 'flee') act({ type: 'combat', move: { move: 'flee' } });
    if (promptCard) act({ type: 'combat', move: { move: 'card', card: promptCard, ...(cardFoe ? { target: cardFoe.uid } : {}), ...(AIMED_CARDS.includes(promptCard) ? aimed : {}) } });
    if (promptScroll) act({ type: 'combat', move: { move: 'scroll', item: promptScroll, target: (chosen ?? alive[0])!.uid, ...aimed } });
    setPrompt(null);
  };
  // The foe the throw waiting in the prompt goes at, for the aim picker.
  const aimFoe = prompt === 'attack' ? chosen : promptScroll ? (chosen ?? alive[0]) : promptCard && AIMED_CARDS.includes(promptCard) ? cardFoe : undefined;
  const aimArmour = aimFoe ? ENEMIES[aimFoe.enemy]!.armour : {};
  /** The spot hit at this point of the playback, for the body maps. */
  const spotHit = (who: string) => (step && (step.kind === 'spot' || step.kind === 'hit') && step.target === who && (step.kind === 'spot' ? step.slot : step.location)
    ? { slot: (step.kind === 'spot' ? step.slot : step.location)!, roll: step.roll }
    : null);

  // Buffs and debuffs as they stand at this point of the playback: a barrier shows from the throw
  // that raised it until the blow that broke it, a trap from the round it was set until it springs.
  const fxAt = (key: string, final: boolean) => {
    if (!busy) return final;
    for (let i = Math.min(at, steps.length - 1); i >= 0; i--) {
      const fx = steps[i]!.fx;
      if (fx?.on === key) return true;
      if (fx?.off === key) return i === at;
    }
    for (let i = at + 1; i < steps.length; i++) {
      const fx = steps[i]!.fx;
      if (fx?.on === key) return false;
      if (fx?.off === key) return true;
    }
    return final;
  };
  const turnNow = busy ? combat.turn - 1 : combat.turn;
  const mistNow = combat.mist !== undefined && turnNow - combat.mist >= 0 && turnNow - combat.mist <= 1;
  const live: LiveFlags = {
    barrier: fxAt('barrier', !!combat.barrier),
    trap: fxAt('trap', !!combat.trap),
    focus: fxAt('focus', combat.focus),
    mist: fxAt('mist', mistNow),
    turn: turnNow,
  };
  const heroFx = heroStatuses(game, me, combat, live, locale);
  const foeFx = Object.fromEntries(combat.foes.map((f) => [f.uid, foeStatuses(combat, f, live, locale)]));
  const openOwner = openFx?.split(':')[0];
  const openStatus = openOwner ? (openOwner === HERO ? heroFx : foeFx[openOwner] ?? []).find((s) => `${openOwner}:${s.key}` === openFx) : undefined;

  return (
    <div className="overlay combat">
      {heroHurt && (
        <motion.div key={`hurt-${at}`} className="hurt-vignette duel-hurt" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ duration: 0.9 }} aria-hidden="true" />
      )}
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
          <AnimatePresence>
            {heroBlow === 'ranged' && (
              <motion.span key={`shot-${at}`} className="projectile" initial={{ left: '18%', opacity: 1 }} animate={{ left: '74%', opacity: [1, 1, 0] }} transition={{ duration: 0.35, ease: 'easeIn' }}>
                <svg viewBox="0 0 60 12" width={60} height={12}><path d="M2 6 L48 6" stroke="#e8d0a0" strokeWidth={3} /><path d="M46 1 L58 6 L46 11 Z" fill="#dfe6f0" /><path d="M2 1 L8 6 L2 11" stroke="#ff8a7a" strokeWidth={2} fill="none" /></svg>
              </motion.span>
            )}
          </AnimatePresence>
          <div className={`side hero-side ${active === HERO ? 'active' : ''}`}>
            <motion.div
              className="avatar"
              animate={step?.kind === 'hit' && step.target === HERO ? { x: [0, -10, 8, -4, 0] }
                : heroBlow === 'melee' ? { x: [0, 70, 0], rotate: [0, 8, 0] }
                : heroBlow === 'ranged' ? { x: [0, -8, 0] }
                : { x: 0 }}
              transition={{ duration: heroBlow ? 0.45 : 0.4 }}
            >
              <StatusFigure list={heroFx}>
                <HeroFigure
                  race={c.race} profession={c.profession} look={c.look} size={combat.foes.length > 1 ? 84 : 96}
                  gear={{ ...heroArmour(me), shield: c.equipment.shield, weapon: weapon.id }}
                  armour={heroArmour(me)} hit={spotHit(HERO)} title={locale === 'pl' ? 'Twój pancerz' : 'Your armour'}
                />
              </StatusFigure>
            </motion.div>
            <b>{c.name}</b>
            <span className="bar hero-bar"><motion.span animate={{ width: `${(heroVit / c.maxVitality) * 100}%` }} /></span>
            <small><Icon name="vitality" size={12} /> {heroVit}/{c.maxVitality}</small>
            <small><Icon name="sword" size={12} /> {itemName(weapon.id, locale)} S{signed(strengthStep(c.attributes.str) + weapon.power)}+k6</small>
            <StatusChips list={heroFx} owner={HERO} open={openFx} onOpen={setOpenFx} />
            {hitFx && step?.kind === 'hit' && step.target === HERO && <HitFx key={`fx-${at}`} kind={hitFx} />}
            <AnimatePresence>{step?.kind === 'hit' && step.target === HERO && <DamagePop key={at} step={step} />}</AnimatePresence>
            {pets.length > 0 && (
              <div className="pets">
                {pets.map((pet) => {
                  const vit = Math.max(0, pet.vitality - lost(pet.uid));
                  return (
                    <motion.div
                      key={pet.uid}
                      className={`pet ${active === pet.uid ? 'active' : ''} ${vit <= 0 ? 'down' : ''}`}
                      animate={step?.kind === 'hit' && step.target === pet.uid ? { x: [0, -8, 6, 0] } : step?.kind === 'hit' && step.who === pet.uid ? { x: [0, 30, 0] } : { x: 0 }}
                      title={foeName(pet.uid, locale)}
                    >
                      <FoeArt kind={ENEMIES[pet.enemy]!.kind} size={34} />
                      <span className="bar hero-bar"><motion.span animate={{ width: `${(vit / pet.maxVitality) * 100}%` }} /></span>
                      <small>{vit}/{pet.maxVitality}{pet.tame ? '' : ` · ${locale === 'pl' ? 'więź' : 'bond'} ${pet.bond}/3`}</small>
                      {hitFx && step?.kind === 'hit' && step.target === pet.uid && <HitFx key={`pfx-${at}`} kind={hitFx} />}
                      <AnimatePresence>{step?.kind === 'hit' && step.target === pet.uid && <DamagePop key={`p${at}`} step={step} />}</AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`duel-centre ${busy || prompt ? '' : 'empty'}`}>
            <AnimatePresence mode="wait">
              {step?.kind === 'roll' && (
                <motion.div key={`roll-${at}`} className={`throw ${step.who === HERO ? 'mine' : 'theirs'}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <TestTitle test={step.test} target={step.result.target} who={`${step.who === HERO ? c.name : step.who === 'foe' ? t('foe') : foeName(step.who, locale)}${step.card ? ` · ${step.card.startsWith('scroll') ? itemName(step.card, locale) : cardName(step.card, locale)}` : ''}`} />
                  <BigDie dice={c.dice} result={step.result} rolling={rolled} onTap={waitingForTap ? () => setRolled(true) : undefined} />
                </motion.div>
              )}
              {step?.kind === 'spot' && (
                <motion.div key={`spot-${at}`} className="spot-step" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <small>{step.who === HERO ? c.name : foeName(step.who, locale)} · {locale === 'pl' ? 'miejsce trafienia' : 'hit location'}</small>
                  {step.roll !== undefined
                    ? <motion.span initial={{ rotate: -200, y: -20 }} animate={{ rotate: 0, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}><DieFace kind="d6" value={step.roll} style={diceStyle(c.dice?.d6)} size={46} /></motion.span>
                    : <span className="big-aim" aria-hidden="true">◎</span>}
                  <span className="spot-line">{step.roll !== undefined ? `k6 = ${step.roll}: ` : ''}{spotName(step.slot, step.roll, locale)}</span>
                  <small>{step.roll !== undefined
                    ? (locale === 'pl' ? `trafienie o ${step.margin} (do 20): miejsce losuje k6` : `hit by ${step.margin} (20 or less): a k6 picks the spot`)
                    : (locale === 'pl' ? `trafienie o ${step.margin} (ponad 20): ${step.who === HERO ? 'wybierasz miejsce' : 'wybiera słabe miejsce'}` : `hit by ${step.margin} (over 20): ${step.who === HERO ? 'you pick the spot' : 'it picks a weak spot'}`)}</small>
                </motion.div>
              )}
              {step?.kind === 'note' && (
                <motion.p key={`note-${at}`} className="duel-note" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{step.text}</motion.p>
              )}
              {!busy && prompt && (
                <motion.div key="prompt" className="throw mine" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <TestTitle test={promptTest} target={promptTarget} who={`${c.name} · ${promptCard ? cardName(promptCard, locale) : promptScroll ? itemName(promptScroll, locale) : prompt === 'attack' ? strike : t('flee')}`} />
                  <BigDie dice={c.dice} onTap={throwDie} />
                  {aimFoe && (
                    <div className="aim-pick">
                      <b>{locale === 'pl' ? 'Celujesz w' : 'Aiming at'}: {aim ? spotName(aim, undefined, locale) : (locale === 'pl' ? 'najsłabsze miejsce' : 'the weakest spot')}</b>
                      <FoeFigure kind={ENEMIES[aimFoe.enemy]!.kind} armour={aimArmour} size={110} aim={aim} onPick={(s) => setAim(aim === s ? null : s)} showRolls title={foeName(aimFoe.uid, locale)} />
                      <small>{locale === 'pl'
                        ? 'Dotknij miejsca. Liczy się, gdy trafisz o ponad 20; inaczej miejsce wylosuje k6. Obrażenia: siła broni + k6 − pancerz.'
                        : 'Tap a spot. It counts when you hit by more than 20; otherwise a k6 picks it. Damage: weapon strength + k6 − armour.'}</small>
                    </div>
                  )}
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
                  <StatusFigure list={foeFx[f.uid] ?? []}>
                    <FoeFigure kind={enemy.kind} armour={enemy.armour} size={combat.foes.length > 1 ? 64 : 96} hit={spotHit(f.uid)} aim={chosen?.uid === f.uid && !busy ? aim : null} title={foeName(f.uid, locale)} />
                  </StatusFigure>
                  <b>{foeName(f.uid, locale)}</b>
                  <span className="bar"><motion.span animate={{ width: `${(vit / f.maxVitality) * 100}%` }} /></span>
                  <small><Icon name="vitality" size={12} /> {vit}/{f.maxVitality} · {t('com')} {enemy.com} · {t('foeHits')} {foeDamage(f.enemy).join('–')}</small>
                  {(petFx ?? hitFx) && step?.kind === 'hit' && step.target === f.uid && <HitFx key={`fx-${at}`} kind={(petFx ?? hitFx)!} />}
                  {f.tamed && <span className="foe-flag tamed">{locale === 'pl' ? 'Oswojony' : 'Tamed'}</span>}
                  {!down && <StatusChips list={foeFx[f.uid] ?? []} owner={f.uid} open={openFx} onOpen={setOpenFx} />}
                  <AnimatePresence>{step?.kind === 'hit' && step.target === f.uid && <DamagePop key={at} step={step} />}</AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>

        {openStatus && openOwner && (
          <StatusDetail status={openStatus} who={openOwner === HERO ? c.name : foeName(openOwner, locale)} onClose={() => setOpenFx(null)} />
        )}

        {!busy && !prompt && (
          <>
            {!chosen && alive.length > 1 && <p className="duel-hint pick-hint">{locale === 'pl' ? 'Wybierz przeciwnika, którego chcesz zaatakować.' : 'Pick the foe you want to strike.'}</p>}
            <p className={`odds ${oddsPct < 50 ? 'grim' : ''}`}>
              {t('winOdds')} ~{oddsPct}%{oddsPct < 50 ? ` · ${t('fleeHint')}` : ''} · {attacksPerTurn(me)} {t('attacksPerTurn')}
            </p>
            <div className="combat-moves">
              <button className="primary with-icon" disabled={!chosen} onClick={() => setPrompt('attack')}><Icon name={weapon.ranged ? 'hunt' : 'sword'} />{strike}</button>
              <button className="ghost with-icon" onClick={() => act({ type: 'combat', move: { move: 'parry' } })}><Icon name="shield" />{t('parry')}</button>
              <button className="ghost" onClick={() => act({ type: 'combat', move: { move: 'focus' } })}>{t('focus')}</button>
              <button className="ghost" onClick={() => setPrompt('flee')}>{t('flee')}</button>
              {potions.map((p) => (
                <button key={p} className="ghost small" onClick={() => act({ type: 'combat', move: { move: 'potion', item: p } })}>{itemName(p, locale)}</button>
              ))}
              {scrollMoves.map((m) => (
                <button
                  key={m.item}
                  className="ghost small scroll-btn"
                  disabled={!!m.target && !chosen && alive.length > 1}
                  onClick={() => (m.target ? setPrompt({ scroll: m.item }) : act({ type: 'combat', move: { move: 'scroll', item: m.item } }))}
                >
                  📜 {itemName(m.item, locale)}
                </button>
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

/** The attack button named for the weapon in hand. */
function weaponStrike(id: string, locale: string): string {
  const pl = locale === 'pl';
  if (id === 'dagger') return pl ? 'Pchnięcie sztyletem' : 'Dagger thrust';
  if (id === 'twoHanded' || id === 'minotaurAxe') return pl ? 'Cios toporem' : 'Axe blow';
  if (id === 'bow' || id === 'longBow') return pl ? 'Strzał z łuku' : 'Bow shot';
  if (id === 'crossbow') return pl ? 'Strzał z kuszy' : 'Crossbow shot';
  return pl ? 'Atak mieczem' : 'Sword strike';
}

/** Cards whose blow can be aimed like a plain attack. */
const AIMED_CARDS = ['warrior-heavy-swing', 'diver-blowpipe', 'explorer-disarm', 'trapper-poison-arrow'];

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
    </div>
  );
}

/** The k100 throw: a k100 die for the tens and a k10 for the units, in the hero's own dice colours.
 *  Before the throw the player can hold and shake them; then they tumble and land on the result. */
function BigDie({ result, rolling = false, onTap, dice }: { result?: TestResult; rolling?: boolean; onTap?: () => void; dice?: DiceLook }) {
  const { tx } = useT();
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
        clack(0.35, 60);
        buzz(result.success ? [30, 40, 30] : 60);
        return;
      }
      setFace(1 + Math.floor(Math.random() * 100));
      if (wait > 60) clack(0.15, 25);
      wait *= 1.17;
      timer = setTimeout(tick, wait);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rolling, result]);

  const spin = rolling && !landed;
  const pair = (shaking: boolean) => <DicePair face={face} spin={spin} shaking={shaking} dice={dice} />;
  return (
    <div className="big-die-wrap">
      {onTap ? (
        <ShakeToThrow onThrow={onTap} hint={tx({ pl: 'Przytrzymaj, potrząśnij i puść', en: 'Hold, shake and let go' })} className="big-die ready">
          {pair}
        </ShakeToThrow>
      ) : (
        <div className={`big-die ${landed ? (result!.success ? 'ok' : 'bad') : ''}`} aria-label={face === null ? 'k100' : String(face)}>
          {pair(false)}
        </div>
      )}
      <AnimatePresence>
        {landed && result && <Verdict success={result.success} />}
      </AnimatePresence>
    </div>
  );
}

/** The two dice of a k100 throw. Shaken, they spin and flicker; thrown, they tumble and settle. */
function DicePair({ face, spin, shaking, dice }: { face: number | null; spin: boolean; shaking: boolean; dice?: DiceLook }) {
  const [wobble, setWobble] = useState<number | null>(null);
  useEffect(() => {
    if (!shaking) return setWobble(null);
    const timer = setInterval(() => setWobble(1 + Math.floor(Math.random() * 100)), 90);
    return () => clearInterval(timer);
  }, [shaking]);
  const shown = shaking ? wobble : face;
  // 100 shows as "00" on the tens die and "0" on the units die.
  const tens = shown === null ? '?' : shown === 100 ? '00' : String(Math.floor(shown / 10) * 10).padStart(2, '0');
  const units = shown === null ? '?' : String(shown % 10);
  return (
    <span className="big-die-pair">
      {[{ text: tens, die: 'd100' as const, d: 0 }, { text: units, die: 'd10' as const, d: 0.08 }].map((x, i) => (
        <motion.span
          key={x.die}
          className={`die big ${x.die === 'd100' ? 'tens' : ''} ${shaking ? 'shaking' : ''}`}
          style={{ ...diceVars(dice, x.die), animationDelay: `${i * -0.11}s` }}
          animate={spin ? { rotate: [0, 260, 420, 380, 360], y: [0, -46, 0, -16, 0], x: [0, i ? 14 : -14, 0] } : { rotate: 0, y: 0, x: 0 }}
          transition={spin ? { duration: ROLL_MS / 1000, ease: 'easeOut', delay: x.d } : { duration: 0.2 }}
        >
          {x.text}
        </motion.span>
      ))}
    </span>
  );
}

function DamagePop({ step }: { step: Extract<Step, { kind: 'hit' }> }) {
  const { locale } = useT();
  const pl = locale === 'pl';
  return (
    <motion.span className="damage-pop" initial={{ y: 0, opacity: 0, scale: 0.6 }} animate={{ y: -34, opacity: 1, scale: 1.2 }} exit={{ opacity: 0, y: -50 }} transition={{ duration: 0.45 }}>
      <span>−{step.damage}{step.location ? <small> {spotName(step.location, step.roll, locale)}</small> : null}</span>
      {step.damageRoll !== undefined && (
        <small className="damage-sum">k6 {step.damageRoll}{step.armour ? ` · ${pl ? 'pancerz' : 'armour'} −${step.armour}` : ''}</small>
      )}
    </motion.span>
  );
}
