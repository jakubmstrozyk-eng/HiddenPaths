import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRIBUTES, DUNGEON_THEMES, EVENT_BY_ID, MAX_VOWS, MISSIONS, TERRAINS, VOWS, VOW_XP, type RaceId, type TerrainAction } from '@hp/content';
import {
  activeVows, applyAction, canWriteJournal, currentPlayer, depletedActions, entryCell, mealDue, missionGoal, missionProgress, isOutside, legalActions, newEntries, OUTSIDE, SIDES, successChance, testModifier, worldView,
  LEVEL_XP, type Action, type GameMap, type GameState, type JournalWrite, type LogEntry, type PlayerState, type Side,
  landAt, roomSpeed, TANNERY_HIDES, tannerySlots,
} from '@hp/engine';
import { TerrainArt } from '../TerrainArt';
import { actionInfo } from '../actionInfo';
import { DiceTray } from '../Dice';
import { useT } from '../i18n';
import { attrShort, cardName, combatLine, describe, diceOf, foeName, itemName, type DiceRoll } from '../logText';
import { HeroArt } from '../HeroArt';
import { EventPanel, StoryPanel } from './Panels';
import { Duel } from './Duel';
import { BagSheet, HeroSheet, TownSheet } from './Sheets';
import { SaveDialog } from './Saves';
import { Tip, type TipId } from '../Tips';
import { Icon, type IconName } from '../Icons';
import { KeepCards, SkillHand } from '../SkillCards';
import { Afflictions } from '../Afflictions';

/** Tannery: the parts of the body, as the card sheet names them (arms and legs are made as a pair here). */
const TANNERY_LABEL = {
  head: { pl: 'Głowa', en: 'Head' }, torso: { pl: 'Korpus', en: 'Torso' }, arms: { pl: 'Ręce', en: 'Arms' }, legs: { pl: 'Nogi', en: 'Legs' },
};
import { CardCastHost } from '../CardArt';
import { HurtFlash, hurtSound, munch } from '../Feedback';
import { DungeonBoard } from '../Dungeon';
import { Campfire, JournalBook, JournalChip } from '../Journal';

/** Which side a hero first stands at, before the player picks one: the side nearest their homeland. */
const HOME_SIDE: Record<RaceId, Side> = { humans: 'S', sunborn: 'W', keepers: 'W', flintborn: 'N', nomads: 'N', myrmids: 'E' };

/** How far outside the board the starting places sit, in fragments. */
const GATE_OUT = 0.9;

/** Where a fragment (or a starting place outside the map) sits, in fragments from the board's top-left corner. */
function spot(map: GameMap, position: number, gate: Side) {
  if (position !== OUTSIDE) return { x: position % map.width, y: Math.floor(position / map.width) };
  // Just outside the fragment a hero steps onto from that side (on shaped maps it need not be the board's edge).
  const e = entryCell(map, gate);
  const x = e % map.width;
  const y = Math.floor(e / map.width);
  if (gate === 'N') return { x, y: y - GATE_OUT };
  if (gate === 'S') return { x, y: y + GATE_OUT };
  if (gate === 'W') return { x: x - GATE_OUT, y };
  return { x: x + GATE_OUT, y };
}

/** The icon shown on a fragment for each thing the hero can do there. */
const TILE_ICONS: Partial<Record<string, IconName>> = {
  hunt: 'hunt', gather: 'gather', herbalism: 'herbalism', mine: 'mine', swim: 'swim', meditate: 'meditate', camp: 'camp', market: 'town', meal: 'food',
};

/** How long the hero takes to walk to the next fragment. */
const WALK_MS = 750;

const TERRAIN_ACTIONS = ['hunt', 'gather', 'herbalism', 'mine', 'swim', 'meditate'] as const satisfies TerrainAction[];
/** Why a used-up action is greyed out on this fragment. */
const DEPLETED_NOTE: Partial<Record<TerrainAction, { pl: string; en: string }>> = {
  hunt: { pl: 'Brak zwierzyny', en: 'No game left' },
  gather: { pl: 'Brak owoców', en: 'No fruit left' },
  herbalism: { pl: 'Brak ziół', en: 'No herbs left' },
  mine: { pl: 'Złoża wyczerpane', en: 'Nothing left to dig' },
};

/** Odds shown on each terrain action button, using the same modifiers as the engine. */
function actionChance(game: GameState, me: PlayerState, action: TerrainAction): number {
  const world = worldView(game);
  const a = me.character.attributes;
  const s = me.character.skills;
  const odds = (attr: keyof typeof a, extra = 0) => successChance(a[attr], testModifier(world, me, attr, extra));
  switch (action) {
    case 'hunt': return odds('dex', s.hunt ?? 0);
    case 'gather': return odds('int', 10 + (s.gather ?? 0));
    case 'herbalism': return odds('int', s.herbalism ?? 0);
    case 'mine': return odds('dex', s.mine ?? 0);
    case 'swim': return odds('dex') * odds('str');
    default: return 1;
  }
}

export function GameScreen({ game, onChange, onMenu, onNew, meId, submit, names = {}, deadline, canSave = false }: {
  game: GameState;
  onChange: (g: GameState) => void;
  onMenu: () => void;
  onNew: () => void;
  /** The signed-in player in a server game; a local game plays as whoever's turn it is. */
  meId?: string;
  /** Sends the action to the server. The state is already updated locally; the server's copy replaces it. */
  submit?: (prev: GameState, action: Action) => Promise<void>;
  names?: Record<string, string>;
  deadline?: string | null;
  /** A game kept on this device shows the floppy button for named saves. */
  canSave?: boolean;
}) {
  const T = useT();
  const { t, tx, locale } = T;
  const turnOf = currentPlayer(game);
  const me = (meId && game.players.find((p) => p.id === meId)) || turnOf;
  const myTurn = turnOf.id === me.id;
  const c = me.character;
  const { width, height, cells } = game.map;
  const actions = useMemo(() => legalActions(game, me.id), [game, me.id]);
  // A Teleport scroll being aimed: its targets take the place of ordinary moves on the board.
  const [aim, setAim] = useState<string | null>(null);
  /** Tannery played from the hand: the player picks the part of the body for the leather piece. */
  const [tannery, setTannery] = useState(false);
  const moves = new Map<number, Action>(aim
    ? actions.flatMap((a) => (a.type === 'scroll' && a.item === aim && a.to !== undefined ? [[a.to, a] as const] : []))
    : actions.flatMap((a) => (a.type === 'move' ? [[a.to, a] as const] : [])));
  const outside = isOutside(me);
  // The board leaves a margin of about one fragment on each side for the starting places outside the map.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setRoom({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Room around the board for heroes still waiting outside it; once everyone is in, the board takes it.
  const rim = game.players.some((p) => isOutside(p)) ? 1.8 : 0.5;
  const boardWidth = Math.max(160, Math.min(room.w * width / (width + rim), room.h * width / (height + rim), 1100));
  const [gate, setGate] = useState<Side>(HOME_SIDE[c.race]);
  const enterable = new Set(actions.flatMap((a) => (a.type === 'enter' ? [a.side] : [])));
  // The dungeon: shown instead of the map while the hero is below, or when they look down the entrance.
  const delving = !!me.delve;
  const [peekDungeon, setPeekDungeon] = useState(false);
  const canGoDown = !delving && actions.some((a) => a.type === 'dungeon');
  const dungeonTheme = game.dungeon ? DUNGEON_THEMES[game.dungeon.theme] : null;
  const showDungeon = !!game.dungeon && (delving || (peekDungeon && me.position === game.dungeon.cell));
  const dungeonExit = actions.find((a) => a.type === 'dungeon' && a.to === 'exit');

  const [last, setLast] = useState<LogEntry[]>([]);
  const [dice, setDice] = useState<{ rolls: DiceRoll[]; heading: string | null } | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [story, setStory] = useState<{ title: string; lines: string[]; xp: number } | null>(null);
  /** Experience gained since the card (or fight) began, shown at the foot of the card. */
  const [sceneXp, setSceneXp] = useState(0);
  const [sheet, setSheet] = useState<'town' | 'bag' | 'hero' | 'save' | 'journal' | null>(null);
  /** The campfire of the hero journal: after a camp, or before leaving the game (Jacob, 2026-11-27). */
  const [campfire, setCampfire] = useState<{ leaving: boolean } | null>(null);
  /** The campfire opens by itself once per camp; after "Not now" the journal button still writes while the fire burns. */
  const campShown = useRef(false);
  const [storyTitle, setStoryTitle] = useState('');
  const [replay, setReplay] = useState<{ before: GameState; entries: LogEntry[] } | null>(null);
  const endReplay = useCallback(() => setReplay(null), []);

  // The hero walks to a new fragment instead of jumping: legs move while the sprite slides across.
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const lastPos = useRef(me.position);
  useEffect(() => {
    const from = lastPos.current;
    lastPos.current = me.position;
    if (from === me.position) return;
    const dx = spot(game.map, me.position, gate).x - spot(game.map, from, gate).x;
    if (dx !== 0) setFacing(dx > 0 ? 1 : -1);
    setWalking(true);
    const timer = setTimeout(() => setWalking(false), WALK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.position, width]);
  // True from the very render in which the hero changes fragment, before the effect above runs.
  const onTheWay = walking || lastPos.current !== me.position;

  // Losing Vitality outside a fight (a fall, a trap on a card, hunger, poison) is felt: a red flash,
  // a thump and a shudder, once the dice for it have landed. Fights show their own blows.
  const prevVit = useRef({ v: c.vitality, id: me.id });
  const [queuedHurt, setQueuedHurt] = useState<{ amount: number; fatal: boolean; cause?: string } | null>(null);
  const [hurt, setHurt] = useState<{ amount: number; fatal: boolean; cause?: string; key: number } | null>(null);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    const prev = prevVit.current;
    prevVit.current = { v: c.vitality, id: me.id };
    if (prev.id !== me.id || me.combat || replay) return;
    const died = last.some((e) => e.type === 'died' && e.player === me.id);
    const lost = prev.v - c.vitality;
    if (lost <= 0 && !died) return;
    const hungry = last.some((e) => e.type === 'hungry' && e.player === me.id && e.vitalityLost > 0);
    setQueuedHurt({ amount: died ? Math.max(1, prev.v) : lost, fatal: died, cause: hungry ? tx({ pl: 'Głód!', en: 'Hunger!' }) : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.version]);
  useEffect(() => {
    if (!queuedHurt || dice || onTheWay) return;
    setHurt({ ...queuedHurt, key: Date.now() });
    setQueuedHurt(null);
    hurtSound(queuedHurt.fatal || queuedHurt.amount >= 5);
    setShaking(true);
    const stop = setTimeout(() => setShaking(false), 460);
    const clear = setTimeout(() => setHurt(null), 2000);
    return () => { clearTimeout(stop); clearTimeout(clear); };
  }, [queuedHurt, dice, onTheWay]);

  /** What a throw is for, shown above the dice: the action, the service or the event that asked for it. */
  const rollHeading = (a: Action, who: PlayerState, entries: LogEntry[]): string | null => {
    const drawn = entries.find((e) => e.type === 'eventDrawn');
    if (drawn && drawn.type === 'eventDrawn') return tx(EVENT_BY_ID[drawn.card]!.title);
    if (who.pendingEvent) return tx(EVENT_BY_ID[who.pendingEvent.card]!.title);
    if (entries.some((e) => e.type === 'dungeonSearch')) return tx({ pl: 'Coś tu jest? · szukasz ukrytego przejścia', en: 'Is something here? · looking for a hidden way' });
    if (a.type === 'terrain') return t(a.action as (typeof TERRAIN_ACTIONS)[number]);
    if (a.type === 'service') return t(a.service);
    if (a.type === 'camp') return a.research ? t('campResearch') : t('camp');
    if (a.type === 'read') return t('read');
    if (a.type === 'scroll') return itemName(a.item, locale);
    if (a.type === 'cook') return tx({ pl: 'Przyrządzanie pożywienia · Zręczność', en: 'Preparing food · Dexterity' });
    if (a.type === 'card') return `${cardName(a.card, locale)}${a.card === 'gourmet-stew' ? ` · ${tx({ pl: 'Inteligencja', en: 'Intelligence' })}` : ''}`;
    // At the start of a turn each lasting condition (plague, nightmare...) is tested again: a pass ends it.
    if (a.type === 'endTurn' && who.conditions.length) {
      return `${who.conditions.map((cd) => tx(cd.name)).join(', ')} · ${tx({ pl: 'próba pozbycia się stanu', en: 'trying to shake it off' })}`;
    }
    return null;
  };

  const act = useCallback((a: Action) => {
    if (currentPlayer(game).id !== me.id) return;
    // The engine is deterministic, so playing the action here gives the same result the server will save.
    const next = applyAction(game, me.id, a);
    const entries = newEntries(game, next);
    setLast(entries);
    // Fight rounds play back throw by throw on the duel screen; other rolls use the dice tray.
    const nextMe0 = next.players.find((p) => p.id === me.id)!;
    if (me.combat) setReplay({ before: game, entries });
    else if (nextMe0.combat && entries.some((e) => e.type === 'combat' && e.event.type === 'trap')) {
      // A trap sprang as the fight broke out: play its throws on the duel screen, from the foes' state before it.
      const before = structuredClone(next);
      const foes = before.players.find((p) => p.id === me.id)!.combat!.foes;
      for (const e of entries) if (e.type === 'combat' && e.event.type === 'trap') foes.find((f) => f.uid === (e.event as { uid: string }).uid)!.vitality += (e.event as { damage: number }).damage;
      setReplay({ before, entries: entries.filter((e) => e.type === 'combat') });
    } else {
      // Only this hero's own throws: another player's rolls at the turn change are not ours to watch.
      const rolls = diceOf(entries.filter((e) => !('player' in e) || e.player === me.id), T);
      if (rolls.length) setDice({ rolls, heading: rollHeading(a, me, entries) });
    }

    const nextMe = next.players.find((p) => p.id === me.id)!;
    const inScene = !!(me.pendingEvent || me.combat);
    const drawn = entries.find((e) => e.type === 'eventDrawn');
    const started = entries.find((e) => e.type === 'combatStarted');
    let title = storyTitle;
    let acc = inScene ? [...lines] : [];
    const gained = nextMe.character.xp - me.character.xp;
    let xpAcc = inScene ? sceneXp + gained : gained;
    if (drawn && drawn.type === 'eventDrawn') {
      title = tx(EVENT_BY_ID[drawn.card]!.title);
      acc = [];
    } else if (started && !inScene) {
      title = t('fight');
    }
    // Experience is not a line of the story: the card shows it at its foot, in full words.
    const fresh = entries.filter((e) => !(e.type === 'revealed' || (e.type === 'change' && e.change.what === 'xp'))).map((e) => (nextMe.combat || me.combat ? combatLine(e, T) : describe(e, T))).filter((l): l is string => !!l);
    acc = [...acc, ...fresh];
    const stillInScene = !!(nextMe.pendingEvent || nextMe.combat);
    if ((inScene || drawn || started) && !stillInScene) {
      setStory({ title, lines: acc, xp: xpAcc });
      setLines([]);
      xpAcc = 0;
    } else if (stillInScene) {
      setLines(acc);
    } else if (entries.some((e) => e.type === 'died' || e.type === 'levelUp' || e.type === 'stoneTaken' || e.type === 'mission')) {
      // Plain actions only open a card for big moments: death, a new level, the Stone.
      const onIt = cells[nextMe.position]?.terrain;
      const terrain = !onIt || onIt === 'void' ? 'core' : onIt;
      setStory({ title: terrain === 'core' ? tx({ pl: 'Kamień początku', en: 'Stone of Beginnings' }) : tx(TERRAINS[terrain].name), lines: fresh, xp: gained });
    }
    setSceneXp(stillInScene ? xpAcc : 0);
    setStoryTitle(title);
    onChange(next);
    void submit?.(game, a);
  }, [game, me, lines, sceneXp, storyTitle, T, t, tx, cells, onChange, submit]);

  /** A journal entry: written by this player, even when it is not their turn (camping ends the turn). */
  const writeJournal = useCallback((entry?: JournalWrite) => {
    const a: Action = { type: 'journal', ...(entry ? { entry } : {}) };
    const next = applyAction(game, me.id, a);
    const entries = newEntries(game, next).filter((e) => !('player' in e) || e.player === me.id);
    setLast(entries);
    const rolls = diceOf(entries, T);
    if (rolls.length) setDice({ rolls, heading: tx({ pl: 'Bestiariusz · Inteligencja', en: 'Bestiary · Intelligence' }) });
    const said = entries.filter((e) => e.type !== 'check').map((e) => describe(e, T)).filter((l): l is string => !!l);
    if (entry && said.length) setStory({ title: tx({ pl: 'Dziennik Wędrowca', en: "Wanderer's Journal" }), lines: said, xp: 0 });
    onChange(next);
    void submit?.(game, a);
  }, [game, me.id, T, tx, onChange, submit]);
  useEffect(() => {
    if (!me.journal?.open) campShown.current = false;
    else if (!campShown.current && !campfire && !me.pendingEvent && !me.combat) {
      campShown.current = true;
      setCampfire({ leaving: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.version, me.id]);
  /** Leaving the game from a camp: a last chance to write what happened (only at camp, Jacob 2026-11-27). */
  const leave = () => {
    if (canWriteJournal(me) && (me.journal?.facts.length ?? 0) > 0) setCampfire({ leaving: true });
    else onMenu();
  };

  // Eating is the player's own move. Ending the turn (or camping, which ends it) without having eaten
  // asks first: eat now and go on, or go on hungry.
  const meal = mealDue(game, me);
  const canEat = actions.some((a) => a.type === 'eat');
  const [mealAsk, setMealAsk] = useState<Action | null>(null);
  const afterEat = useRef<Action | null>(null);
  const eat = useCallback(() => { munch(); act({ type: 'eat' }); }, [act]);
  const endWith = (a: Action) => {
    if (canEat) setMealAsk(a);
    else act(a);
  };
  useEffect(() => {
    const a = afterEat.current;
    afterEat.current = null;
    if (a && mealDue(game, me).left === 0) act(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.version]);
  const noMovesLeft = !actions.some((a) => a.type === 'move' || a.type === 'enter');

  // Fragments revealed by the last action dissolve from the side the hero came in.
  const revealedNow = new Set(last.flatMap((e) => (e.type === 'revealed' ? [e.cell] : [])));
  const steppedIn = last.some((e) => e.type === 'moved' && e.player === me.id && e.from === OUTSIDE);
  const origin = (cell: number) => {
    if (cell !== me.position || (me.cameFrom === null && !steppedIn)) return { x: '50%', y: '50%' };
    const from = me.cameFrom ?? OUTSIDE;
    const a = spot(game.map, from, gate);
    const b = spot(game.map, cell, gate);
    const dx = Math.sign(a.x - b.x);
    const dy = Math.sign(a.y - b.y);
    return { x: `${50 + dx * 50}%`, y: `${50 + dy * 50}%` };
  };

  const here = outside ? null : { ...cells[me.position]!, terrain: landAt(game.map, me.position) };
  const hereTerrain = !here || here.terrain === 'core' ? null : TERRAINS[here.terrain];
  const terrainActs = actions.flatMap((a) => (a.type === 'terrain' ? [a.action] : []));
  const inTown = !!here && (here.terrain === 'inn' || here.terrain === 'village' || here.terrain === 'city');
  const quiet = myTurn && !me.pendingEvent && !me.combat && !game.winner;
  const others = game.players.filter((p) => p.id !== me.id);
  const hoursLeft = deadline ? Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000)) : null;
  const tipsFor = (): TipId[] => {
    if (me.combat) return ['combat'];
    if (me.pendingEvent) return ['event'];
    if (sheet) return [];
    if (outside) return [];
    const out: TipId[] = ['move'];
    if (inTown) out.push('town');
    if (!actions.some((a) => a.type === 'move')) out.push('endTurn');
    return out;
  };
  const lastNote = last.map((e) => describe(e, T)).filter(Boolean).slice(-3).join(' · ');

  return (
    <div className={`game ${shaking ? 'shaking' : ''}`}>
      <header className="hud">
        <button className="ghost small with-icon" onClick={leave}><Icon name="menu" />{t('menu')}</button>
        {canSave && (
          <button className="ghost small with-icon" onClick={() => setSheet('save')} title={tx({ pl: 'Zapisz grę', en: 'Save game' })}>
            <Icon name="save" />{tx({ pl: 'Zapisz grę', en: 'Save game' })}
          </button>
        )}
        <div className="who">
          <HeroArt race={c.race} profession={c.profession} look={c.look} size={28} />
          <span>
            <b>{c.name}</b> · {t('level')} {c.level} · {t('round')} {game.round}
          </span>
        </div>
        <JournalChip me={me} onOpen={() => setSheet('journal')} />
        {/* Hero, bag and journal: in the bar on a computer, pinned to the bottom of the screen on a phone. */}
        <nav className="game-nav" aria-label={tx({ pl: 'Bohater', en: 'Hero' })}>
          <button className={`ghost with-icon ${c.unspentPoints > 0 ? 'badge' : ''}`} disabled={!quiet} onClick={() => setSheet('hero')}><Icon name="xp" /><span>{t('heroSheet')}</span></button>
          <button className="ghost with-icon" disabled={!quiet} onClick={() => setSheet('bag')}><Icon name="bag" /><span>{t('bag')}</span></button>
          <button className="ghost with-icon" onClick={() => setSheet('journal')}><span aria-hidden="true" className="nav-emoji">📖</span><span>{tx({ pl: 'Dziennik', en: 'Journal' })}</span></button>
        </nav>
        <div className="stats">
          <MoveBar icon="speed" label={t('speed')} left={me.speedLeft} max={c.speed} kind="speed" />
          <MoveBar icon="stamina" label={t('stamina')} left={me.staminaLeft} max={c.stamina} kind="stamina" />
          <Stat key={hurt?.key ?? 'vit'} icon="vitality" label={t('vitality')} value={`${c.vitality}/${c.maxVitality}`} warn={c.vitality <= c.maxVitality / 3} hit={!!hurt} />
          <FoodBar food={c.food} meals={meal.needed} eaten={meal.eaten} label={t('food')} canEat={canEat && quiet} urgent={noMovesLeft} onEat={eat} />
          <Stat icon="gold" label={t('gold')} value={Number.isInteger(c.gold) ? c.gold : c.gold.toFixed(2)} />
          <XpBar xp={c.xp} level={c.level} />
        </div>
      </header>

      <Afflictions game={game} me={me} compact className="top" />

      <div className="play-area">
        <div className="board-wrap" ref={wrapRef}>
          {showDungeon && <DungeonBoard game={game} me={me} actions={quiet ? actions : []} act={act} onClose={() => setPeekDungeon(false)} />}
          <div className="board" hidden={showDungeon} style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width} / ${height}`, width: boardWidth }}>
            {cells.map((cell) => {
              // A square outside the map's outline: an empty gap in the board.
              if (cell.terrain === 'void') return <span key={cell.index} className="frag-hole" aria-hidden="true" />;
              const seen = me.revealed.includes(cell.index);
              const move = quiet ? moves.get(cell.index) : undefined;
              const name = cell.terrain === 'core' ? (me.hasStone ? '◇' : '◆') : tx(TERRAINS[cell.terrain].name);
              const o = origin(cell.index);
              const isHere = seen && cell.index === me.position;
              const icons = seen && cell.terrain !== 'core'
                ? [...new Set(TERRAINS[cell.terrain].actions.flatMap((x) => (TILE_ICONS[x] ? [TILE_ICONS[x]!] : [])))].slice(0, 4)
                : [];
              return (
                <button
                  key={cell.index}
                  className={`frag ${move ? 'reachable' : ''} ${move && aim ? 'aim' : ''} ${isHere ? 'here-tile' : ''} ${seen ? 'seen' : ''}`}
                  disabled={!move}
                  onClick={() => { if (!move) return; setAim(null); act(move); }}
                  aria-label={seen ? name : move ? `${t('tapToMove')}` : undefined}
                >
                  {seen && <TerrainArt terrain={cell.terrain} seed={cell.index} />}
                  {seen && <span className="frag-name">{name}</span>}
                  {icons.length > 0 && (
                    <span className="frag-icons">{icons.map((i) => <Icon key={i} name={i} size={16} />)}</span>
                  )}
                  {seen && game.dungeon?.cell === cell.index && game.dungeon.foundBy.includes(me.id) && (
                    <span className={`frag-dungeon ${game.dungeon.plundered ? 'plundered' : ''}`} title={dungeonTheme ? tx(dungeonTheme.name) : ''}>
                      ⛬<small>{game.dungeon.plundered ? tx({ pl: 'Oczyszczony', en: 'Cleared' }) : tx({ pl: 'Loch', en: 'Dungeon' })}</small>
                    </span>
                  )}
                  {me.hints?.includes(cell.index) && !game.dungeon?.foundBy.includes(me.id) && (
                    <span className="frag-hint" title={tx({ pl: 'Przeczucie ze snu: coś tu jest ukryte', en: 'A hunch from a dream: something is hidden here' })}>?</span>
                  )}
                  {seen && cell.terrain !== 'core' && TERRAINS[cell.terrain].hard && <span className="frag-hard" title={t('speed')}><Icon name="speed" size={10} />2</span>}
                  {!seen && (
                    <span className="void-wrap">
                      <span className="void" />
                    </span>
                  )}
                  {revealedNow.has(cell.index) && (
                    <span key={game.version} className="void-wrap dissolving" style={{ ['--ox' as string]: o.x, ['--oy' as string]: o.y }}>
                      <span className="void" />
                    </span>
                  )}
                </button>
              );
            })}
            {outside && SIDES.map((side) => {
              const p = spot(game.map, OUTSIDE, side);
              const open = quiet && enterable.has(side);
              return (
                <button
                  key={side}
                  className={`gate gate-${side} ${gate === side ? 'chosen' : ''}`}
                  style={{ left: `${(p.x / width) * 100}%`, top: `${(p.y / height) * 100}%`, width: `${100 / width}%`, height: `${100 / height}%` }}
                  disabled={!open}
                  onMouseEnter={() => setGate(side)}
                  onFocus={() => setGate(side)}
                  onClick={() => {
                    setGate(side);
                    const a = actions.find((x) => x.type === 'enter' && x.side === side);
                    if (a) act(a);
                  }}
                  aria-label={`${t('enterFrom')} ${t(`side${side}` as const)}`}
                >
                  <span className="gate-arrow" aria-hidden="true">{side === 'N' ? '▼' : side === 'S' ? '▲' : side === 'W' ? '▶' : '◀'}</span>
                  <small>{t(`side${side}` as const)}</small>
                </button>
              );
            })}
            {others.filter((p) => !isOutside(p)).map((p) => (
              <motion.div
                key={p.id}
                className="hero other"
                initial={false}
                animate={{ left: `${((p.position % width) / width) * 100}%`, top: `${(Math.floor(p.position / width) / height) * 100}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                style={{ width: `${100 / width}%`, height: `${100 / height}%` }}
                title={names[p.id] ?? p.character.name}
              >
                <span className="figurine">
                  <HeroArt race={p.character.race} profession={p.character.profession} look={p.character.look} size={28} />
                </span>
                <small className="hero-tag">{p.character.name}</small>
              </motion.div>
            ))}
            <motion.div
              className={`hero ${outside ? 'waiting-outside' : ''}`}
              initial={false}
              animate={{
                left: `${(spot(game.map, me.position, gate).x / width) * 100}%`,
                top: `${(spot(game.map, me.position, gate).y / height) * 100}%`,
              }}
              transition={{ duration: (outside ? 0.35 : WALK_MS / 1000), ease: outside ? 'easeOut' : 'linear' }}
              style={{ width: `${100 / width}%`, height: `${100 / height}%` }}
            >
              <span className="figurine">
                <HeroArt race={c.race} profession={c.profession} look={c.look} size={40} walking={walking} facing={facing} />
              </span>
            </motion.div>
          </div>
        </div>
        <div className="play-side">
        {!myTurn && !game.winner && (
          <p className="waiting">
            {locale === 'pl' ? `Ruch gracza ${names[turnOf.id] ?? turnOf.character.name}` : `${names[turnOf.id] ?? turnOf.character.name} is playing`}
            {hoursLeft !== null ? (locale === 'pl' ? ` · zostało ok. ${hoursLeft} h` : ` · about ${hoursLeft} h left`) : ''}
          </p>
        )}
        <aside className="frag-panel" aria-label={tx({ pl: 'Na tym fragmencie', en: 'On this fragment' })}>
          <p className="here">
            <Icon name="map" size={14} /> <b>{delving && dungeonTheme ? tx(dungeonTheme.name) : outside ? t('beforeMap') : hereTerrain ? tx(hereTerrain.name) : tx({ pl: 'Kamień początku', en: 'Stone of Beginnings' })}</b>
            {outside ? ` · ${t('pickSide')}` : delving ? ` · ${tx({ pl: 'Wybierz korytarz albo wyjdź z lochu', en: 'Pick a corridor or climb out' })}` : me.hasStone ? ` · ${t('stoneCarried')}` : lastNote ? ` · ${lastNote}` : ` · ${t('tapToMove')}`}
          </p>
          <Afflictions game={game} me={me} className="aff-side" />
          {aim && (
            <p className="conditions-note aim-note">
              {tx({ pl: 'Teleportacja: wybierz fragment do 2 pól stąd.', en: 'Teleport: pick a fragment up to 2 steps away.' })}{' '}
              <button className="ghost small" onClick={() => setAim(null)}>{t('back')}</button>
            </p>
          )}
          {(me.companions?.length ?? 0) > 0 && (
            <p className="companions-note">
              🐾 {me.companions!.map((pet) => `${foeName(pet.uid, locale)} ${pet.vitality}/${pet.maxVitality}${pet.tame ? '' : ` · ${tx({ pl: 'więź', en: 'bond' })} ${pet.bond}/3`}`).join(' · ')}
            </p>
          )}
          {(me.meals?.length ?? 0) > 0 && (
            <p className="companions-note">
              {tx({ pl: 'Przyrządzone porcje', en: 'Prepared portions' })}: {me.meals!.map((m) => (m.kind === 'stew' ? tx({ pl: 'potrawka (+2 Żyw.)', en: 'stew (+2 Vit)' }) : m.spice ? `${tx({ pl: 'przyprawiona', en: 'seasoned' })} ${attrShort(m.spice, locale)}` : tx({ pl: 'przyrządzona', en: 'prepared' }))).join(', ')}
            </p>
          )}
          <small className="frag-panel-head">{tx({ pl: 'Co możesz tu zrobić', en: 'What you can do here' })}</small>
          <div className="frag-actions">
            {canGoDown && quiet && dungeonTheme && !showDungeon && (
              <button className="ghost act-btn dungeon-btn" onClick={() => setPeekDungeon(true)}>
                <span className="act-title">⛬ {tx({ pl: 'Zejdź do lochu', en: 'Go down into the dungeon' })}: {tx(dungeonTheme.name)}</span>
                <small className="act-test">{tx({ pl: 'Komnaty, pułapki i pan lochu; na końcu skarbiec z reliktem', en: 'Rooms, traps and a lord; a vault with a relic at the end' })}</small>
                <small className="act-reward">
                  {tx({ pl: `Każda komnata: −${roomSpeed(game)} Sz., −1 Wt.`, en: `Each room: −${roomSpeed(game)} Speed, −1 Stamina` })}
                  {c.level < 3 ? ` · ${tx({ pl: 'Uwaga: niebezpieczne przed 3. poziomem', en: 'Careful: dangerous before level 3' })}` : ''}
                </small>
              </button>
            )}
            {delving && quiet && dungeonExit && (
              <button className="ghost act-btn" onClick={() => act(dungeonExit)}>
                <span className="act-title">⇡ {tx({ pl: 'Wyjdź z lochu', en: 'Climb out of the dungeon' })}</span>
                <small className="act-reward">{tx({ pl: 'Wracasz przez przebyte komnaty · −1 Sz. · oczyszczone komnaty zostają oczyszczone', en: 'Back through the rooms you walked · −1 Speed · cleared rooms stay cleared' })}</small>
              </button>
            )}
            {here && TERRAIN_ACTIONS.filter((a) => terrainActs.includes(a)).map((a) => {
              const info = actionInfo(a, here.terrain as Exclude<typeof here.terrain, 'core'>);
              return (
                <button key={a} className="ghost act-btn" onClick={() => act({ type: 'terrain', action: a })}>
                  <span className="act-title"><Icon name={a} size={14} />{t(a)}</span>
                  <small className="act-test">
                    {info.test ? `${tx({ pl: 'Test', en: 'Test' })}: ${tx(info.test)} · ${Math.round(actionChance(game, me, a) * 100)}%` : tx({ pl: 'Bez testu', en: 'No test' })}
                  </small>
                  <small className="act-reward">
                    {tx(info.reward)}{info.risk ? ` · ${tx(info.risk)}` : ''}{info.cost ? ` · −${info.cost} ${t('staminaShort')}` : ''}
                  </small>
                </button>
              );
            })}
            {here && hereTerrain && depletedActions(game, me.position).filter((d) => hereTerrain.actions.includes(d.action)).map((d) => (
              <button key={`gone-${d.action}`} className="ghost act-btn depleted" disabled title={tx({ pl: 'Surowiec wyczerpany po udanej akcji', en: 'Used up by a successful action' })}>
                <span className="act-title"><Icon name={d.action as (typeof TERRAIN_ACTIONS)[number]} size={14} />{t(d.action as (typeof TERRAIN_ACTIONS)[number])}</span>
                <small className="act-test">{tx(DEPLETED_NOTE[d.action] ?? { pl: 'Wyczerpane', en: 'Used up' })}</small>
                <small className="act-reward">{tx({ pl: `Wróci w rundzie ${d.until}`, en: `Back in round ${d.until}` })}</small>
              </button>
            ))}
            {inTown && quiet && (
              <button className="ghost act-btn town-btn" onClick={() => setSheet('town')}>
                <span className="act-title"><Icon name="town" size={14} />{tx({ pl: 'Wejdź', en: 'Go in' })}: {hereTerrain ? tx(hereTerrain.name) : t('town')}</span>
                <small className="act-reward">{here?.terrain === 'inn' ? tx({ pl: 'szynk, stół podróżnych, pokoje', en: 'bar, travellers\' table, rooms' }) : here?.terrain === 'city' ? tx({ pl: 'karczma, kuźnia, plac, targ, kupiec, wieża mistyka', en: 'tavern, smithy, yard, market, merchant, mystic' }) : tx({ pl: 'karczma, kuźnia, plac, targ, kupiec', en: 'tavern, smithy, yard, market, merchant' })}</small>
              </button>
            )}
            {me.journal && (
              <button className="ghost act-btn journal-btn" onClick={() => (canWriteJournal(me) ? setCampfire({ leaving: false }) : setSheet('journal'))}>
                <span className="act-title"><span aria-hidden="true">📖</span>{canWriteJournal(me) ? tx({ pl: 'Zapisz w dzienniku', en: 'Write in the journal' }) : tx({ pl: 'Otwórz dziennik', en: 'Open the journal' })}</span>
                <small className="act-reward">{canWriteJournal(me)
                  ? tx({ pl: 'Jesteś w obozowisku: wpis o tym, co się wydarzyło od ostatniego', en: 'You are at camp: an entry on what happened since the last one' })
                  : tx({ pl: 'Tylko do czytania · wpisy dodasz w obozowisku', en: 'Read only · entries are written at camp' })}</small>
              </button>
            )}
            {myTurn && actions.some((a) => a.type === 'camp') && (
              <button className="ghost with-icon" onClick={() => endWith({ type: 'camp' })}><Icon name="camp" />{t('camp')}</button>
            )}
            {myTurn && actions.some((a) => a.type === 'camp' && a.research) && (
              <button className="ghost with-icon" onClick={() => endWith({ type: 'camp', research: true })}><Icon name="cards" />{t('campResearch')} <small className="odds">+1 Int</small></button>
            )}
            {myTurn && quiet && actions.some((a) => a.type === 'cook') && (
              <div className="cook-box">
                <button className="ghost act-btn" onClick={() => act({ type: 'cook' })}>
                  <span className="act-title"><Icon name="food" size={14} />{tx({ pl: 'Przyrządź pożywienie', en: 'Prepare food' })}</span>
                  <small className="act-test">{tx({ pl: 'Test', en: 'Test' })}: {tx({ pl: 'Zręczność', en: 'Dexterity' })} · {Math.round(successChance(c.attributes.dex, testModifier(worldView(game), me, 'dex')) * 100)}%</small>
                  <small className="act-reward">{tx({ pl: 'zjedzona porcja: +2 do cech na rundę', en: 'the portion eaten: +2 to attributes for a round' })} · −1 {t('staminaShort')}</small>
                </button>
                {actions.some((a) => a.type === 'cook' && a.spice) && (
                  <span className="cook-spices">
                    <small>{cardName('gourmet-seasoning', locale)} (+5):</small>
                    {ATTRIBUTES.map((attr) => (
                      <button key={attr} className="ghost small" onClick={() => act({ type: 'cook', spice: attr })}>{attrShort(attr, locale)}</button>
                    ))}
                  </span>
                )}
              </div>
            )}
            {myTurn && quiet && actions.some((a) => a.type === 'smelt') && (
              <button className="ghost act-btn" onClick={() => act({ type: 'smelt', into: 'ore' })}>
                <span className="act-title"><Icon name="mine" size={14} />{cardName('runemaster-smelt', locale)}</span>
                <small className="act-reward">{tx({ pl: '3 sztuki broni lub zbroi → 1 żelazo', en: '3 weapons or armour pieces → 1 iron' })}</small>
              </button>
            )}
            {myTurn && quiet && actions.some((a) => a.type === 'smelt') && (
              <button className="ghost act-btn" onClick={() => act({ type: 'smelt', into: 'item' })}>
                <span className="act-title"><Icon name="mine" size={14} />{cardName('runemaster-smelt', locale)}</span>
                <small className="act-reward">{tx({ pl: '3 sztuki broni lub zbroi → nowy zwykły przedmiot', en: '3 weapons or armour pieces → a new common item' })}</small>
              </button>
            )}
            {myTurn && quiet && !!me.counters[`hiddenAt:${me.position}`] && (
              <small className="act-reward">{tx({ pl: 'Ukrywasz się tutaj (Kamuflaż): możesz tylko odejść z tego fragmentu.', en: 'You are hiding here (Camouflage): you can only move on from this fragment.' })}</small>
            )}
            {myTurn && quiet && tannery && actions.some((a) => a.type === 'card' && a.card === 'trapper-tannery') && (
              <div className="cook-box">
                <span className="act-btn">
                  <span className="act-title"><Icon name="cards" size={14} />{cardName('trapper-tannery', locale)}</span>
                  <small className="act-reward">
                    {tx({ pl: `Skóry: ${me.counters.hides ?? 0} · wybierz część ciała (ile skór) · test Int · −1 Wt`, en: `Hides: ${me.counters.hides ?? 0} · pick the part of the body (hides needed) · Int test · −1 Stamina` })}
                  </small>
                </span>
                <span className="cook-spices">
                  {(Object.keys(TANNERY_HIDES) as (keyof typeof TANNERY_HIDES)[]).map((slot) => (
                    <button key={slot} className="ghost small" disabled={!tannerySlots(me).includes(slot)} onClick={() => { setTannery(false); act({ type: 'card', card: 'trapper-tannery', target: slot }); }}>
                      {tx(TANNERY_LABEL[slot])} ({TANNERY_HIDES[slot]})
                    </button>
                  ))}
                  <button className="ghost small" onClick={() => setTannery(false)}>{tx({ pl: 'Anuluj', en: 'Cancel' })}</button>
                </span>
              </div>
            )}
            {myTurn && actions.some((a) => a.type === 'camp' && a.card) && actions.flatMap((a) => (a.type === 'camp' && a.card ? [a.card] : [])).map((card) => (
              <button key={card} className="ghost with-icon" onClick={() => endWith({ type: 'camp', card, ...(card === 'druid-teacher' && me.companions?.[0] ? { target: me.companions[0].uid } : {}) })}>
                <Icon name="camp" />{tx({ pl: 'Obóz', en: 'Camp' })} + {cardName(card, locale)} <small className="odds">{card === 'warrior-way' ? tx({ pl: '+1 Walki · −1 Wt', en: '+1 Combat · −1 Stamina' }) : tx({ pl: 'test SW · towarzysz +1 · −2 Wt', en: 'Wil test · companion +1 · −2 Stamina' })}</small>
              </button>
            ))}
            {myTurn && quiet && actions.some((a) => a.type === 'reinforce') && (
              <div className="cook-box">
                <span className="act-btn">
                  <span className="act-title"><Icon name="shield" size={14} />{cardName('runemaster-reinforce', locale)}</span>
                  <small className="act-reward">{tx({ pl: '3 podstawowe surowce → +1 pancerza · kończy rundę', en: '3 basic materials → +1 armour · ends the round' })}</small>
                </span>
                <span className="cook-spices">
                  {actions.flatMap((a) => (a.type === 'reinforce' ? [a.slot] : [])).map((slot) => (
                    <button key={slot} className="ghost small" onClick={() => endWith({ type: 'reinforce', slot })}>{t(slot)}</button>
                  ))}
                </span>
              </div>
            )}
            {myTurn && quiet && canEat && (
              <button className={`eat-btn act-meal due ${noMovesLeft ? 'urgent' : ''}`} onClick={eat}>
                <Icon name="food" size={16} />{tx({ pl: 'Zjedz posiłek', en: 'Eat a meal' })} · −{meal.left}
              </button>
            )}
            <button className="primary end-turn" disabled={!quiet} onClick={() => endWith({ type: 'endTurn' })}>
              {t('endTurn')}
              <small>{mealNote(meal, c.food, locale)}</small>
            </button>
          </div>
        </aside>
        <SkillHand
          profession={c.profession}
          owned={c.cards}
          actor={me}
          playable={quiet ? actions.flatMap((a) => (a.type === 'card' ? [a.card] : [])) : []}
          onPlay={(card) => (card === 'trapper-tannery' ? setTannery(true) : act({ type: 'card', card }))}
        />
        <GoalsPanel game={game} me={me} />
        </div>
      </div>


      <AnimatePresence>
        {!onTheWay && me.pendingEvent && !me.combat && <EventPanel key="event" game={game} me={me} lines={lines} xp={sceneXp} act={act} hold={!!dice} />}
        {!onTheWay && (replay || me.combat) && (
          <Duel
            key="combat"
            game={replay ? replay.before : game}
            me={(replay ? replay.before : game).players.find((p) => p.id === me.id)!}
            entries={replay?.entries ?? null}
            act={act}
            onReplayDone={endReplay}
          />
        )}
        {!onTheWay && !replay && story && !me.pendingEvent && !me.combat && <StoryPanel key="story" title={story.title} lines={story.lines} xp={story.xp} level={c.level} xpNow={c.xp} onClose={() => setStory(null)} />}
        {sheet === 'town' && quiet && <TownSheet key="town" game={game} me={me} act={act} onClose={() => setSheet(null)} />}
        {sheet === 'bag' && quiet && <BagSheet key="bag" game={game} me={me} act={act} onClose={() => setSheet(null)} onAim={(item) => { setAim(item); setSheet(null); }} />}
        {sheet === 'save' && <SaveDialog key="save" game={game} onClose={() => setSheet(null)} />}
        {sheet === 'hero' && quiet && <HeroSheet key="hero" game={game} me={me} act={act} onClose={() => setSheet(null)} />}
        {sheet === 'journal' && me.journal && (
          <JournalBook
            key="journal"
            hero={c}
            summary={me.journal.summary}
            entries={me.journal.written}
            inspiration={me.journal.inspiration}
            vows={activeVows(me.journal)}
            campNote
            level={c.level}
            note={me.journal.summary.entries > me.journal.written.length ? tx({ pl: 'Kronika pokazuje wpisy z tej gry. Cały dziennik znajdziesz w ekranie Bohaterowie.', en: 'The chronicle shows entries from this game. The whole journal is on the Heroes screen.' }) : undefined}
            onClose={() => setSheet(null)}
            onWrite={canWriteJournal(me) ? () => { setSheet(null); setCampfire({ leaving: false }); } : undefined}
          />
        )}
        {campfire && !dice && !onTheWay && !replay && !me.pendingEvent && !me.combat && (
          <Campfire
            key="campfire"
            game={game}
            me={me}
            leaving={campfire.leaving}
            onWrite={(entry) => { const leaving = campfire.leaving; setCampfire(null); writeJournal(entry); if (leaving) onMenu(); }}
            onSkip={() => { const leaving = campfire.leaving; setCampfire(null); if (leaving) onMenu(); }}
          />
        )}
        {game.winner && !story && (
          <div className="overlay" key="won">
            <motion.article className="card victory" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <h2>{game.winner === me.id ? t('victory') : `${names[game.winner] ?? game.players.find((p) => p.id === game.winner)?.character.name} ${locale === 'pl' ? 'wygrywa' : 'wins'}`}</h2>
              <p className="card-text">{game.config.winMode === 'stone' ? t('victoryStone') : t('victoryExploration')}</p>
              <div className="card-options">
                <button className="primary" onClick={onNew}>{t('newGameShort')}</button>
                <button className="ghost" onClick={onMenu}>{t('menu')}</button>
              </div>
            </motion.article>
          </div>
        )}
        {myTurn && !onTheWay && !replay && !me.combat && !dice && (!!c.newCards?.length || !!c.chooseCards) && (
          <KeepCards key="keep" profession={c.profession} held={[...c.cards, ...(c.benched ?? [])]} fresh={c.newCards ?? []} start={!!c.chooseCards && !c.newCards?.length} onKeep={(cards) => act({ type: 'keepCards', cards })} />
        )}
        {mealAsk && (
          <MealReminder
            key="meal"
            left={meal.left}
            food={c.food}
            hungerRounds={me.roundsWithoutFood + 1}
            onEat={() => { afterEat.current = mealAsk; setMealAsk(null); eat(); }}
            onSkip={() => { const a = mealAsk; setMealAsk(null); act(a); }}
            onBack={() => setMealAsk(null)}
          />
        )}
        {dice && <DiceTray key={`dice-${game.version}`} rolls={dice.rolls} heading={dice.heading} base={c.attributes} dice={c.dice} onDone={() => setDice(null)} />}
      </AnimatePresence>
      {myTurn && !game.winner && !dice && !story && !campfire && <Tip candidates={tipsFor()} />}
      <CardCastHost />
      <AnimatePresence>{hurt && <HurtFlash key={hurt.key} amount={hurt.amount} fatal={hurt.fatal} cause={hurt.cause} />}</AnimatePresence>
    </div>
  );
}

function Stat({ icon, label, value, warn, hit }: { icon: IconName; label: string; value: string | number; warn?: boolean; hit?: boolean }) {
  return (
    <span className={`stat ${warn ? 'warn' : ''} ${hit ? 'hit' : ''}`}>
      <small>{label}</small>
      <b><Icon name={icon} size={14} /> {value}</b>
    </span>
  );
}

/**
 * Experience, always in sight: the level, a bar filling towards the next one, the points gained
 * and how many are still missing.
 */
function XpBar({ xp, level }: { xp: number; level: number }) {
  const { tx } = useT();
  const from = LEVEL_XP[level] ?? 0;
  const to = LEVEL_XP[level + 1];
  const have = Math.floor(xp);
  const share = to === undefined ? 1 : Math.min(1, Math.max(0, (xp - from) / (to - from)));
  return (
    <span className="stat xpbar" role="meter" aria-label={tx({ pl: 'Punkty Doświadczenia', en: 'Experience' })} aria-valuemin={from} aria-valuemax={to ?? from} aria-valuenow={have}>
      <small>{tx({ pl: `Doświadczenie · poziom ${level}`, en: `Experience · level ${level}` })}</small>
      <b><Icon name="xp" size={14} /> {have}{to !== undefined ? ` / ${to}` : ''}</b>
      <span className="xp-track" aria-hidden="true"><motion.span initial={false} animate={{ width: `${share * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} /></span>
      <small className="xp-left">
        {to === undefined
          ? tx({ pl: 'najwyższy poziom', en: 'top level' })
          : tx({ pl: `brakuje ${Math.ceil(to - xp)} do poziomu ${level + 1}`, en: `${Math.ceil(to - xp)} to level ${level + 1}` })}
      </small>
    </span>
  );
}

/** What this round's meal still asks of the player, in words, under the end-turn button. */
function mealNote(meal: { needed: number; left: number }, food: number, locale: string): string {
  const pl = locale === 'pl';
  if (meal.needed === 0) return pl ? 'dziś bez posiłku' : 'no meal today';
  if (meal.left === 0) return pl ? 'posiłek zjedzony' : 'meal eaten';
  if (food < meal.left) return pl ? 'brak jedzenia: głód!' : 'no food: hunger!';
  return pl ? 'najpierw zjedz posiłek!' : 'eat your meal first!';
}

/**
 * Food as a row of rations, with the bread button: the player eats this round's meal themselves.
 * The button glows until they do, and pulses red once the hero has nowhere left to walk this turn.
 */
function FoodBar({ food, meals, eaten, label, canEat, urgent, onEat }: {
  food: number; meals: number; eaten: number; label: string; canEat: boolean; urgent: boolean; onEat: () => void;
}) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const left = Math.max(0, meals - eaten);
  const shown = Math.min(food, 12);
  const days = meals === 0 ? null : Math.floor(food / Math.max(1, meals));
  return (
    <span className={`stat movebar food food-stat ${left > 0 && food < left ? 'warn' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuenow={food}>
      <small>{label} · {meals === 0 ? (pl ? 'dziś bez posiłku' : 'no meal today') : `${meals}/${pl ? 'runda' : 'round'}`}</small>
      <b><Icon name="food" size={14} /> {food}{days !== null ? <em className="food-days">{pl ? ` · na ${days} ${days === 1 ? 'rundę' : 'rund'}` : ` · ${days} ${days === 1 ? 'round' : 'rounds'}`}</em> : null}</b>
      <span className="pips" aria-hidden="true">
        {food === 0 && <i className="empty" />}
        {Array.from({ length: shown }, (_, i) => (
          <motion.i key={i} className={`on ${i >= shown - left ? 'eaten' : ''}`} initial={false} animate={{ scaleY: 1, opacity: 1 }} />
        ))}
        {food > shown && <small className="more">+{food - shown}</small>}
      </span>
      {canEat ? (
        <button className={`eat-btn due ${urgent ? 'urgent' : ''}`} onClick={onEat} title={pl ? 'Zjedz posiłek na tę rundę' : 'Eat this round\'s meal'}>
          <Icon name="food" size={14} />{pl ? 'Zjedz' : 'Eat'}
        </button>
      ) : meals > 0 && left === 0 ? (
        <span className="eat-done">✓ {pl ? 'najedzony' : 'fed'}</span>
      ) : meals > 0 && food < left ? (
        <span className="eat-hungry">{pl ? 'brak jedzenia!' : 'no food!'}</span>
      ) : null}
    </span>
  );
}

/** Asked when the turn would end before the hero has eaten: eat and go on, or go on hungry. */
function MealReminder({ left, food, hungerRounds, onEat, onSkip, onBack }: {
  left: number; food: number; hungerRounds: number; onEat: () => void; onSkip: () => void; onBack: () => void;
}) {
  const { tx } = useT();
  const penalty = hungerRounds >= 9
    ? tx({ pl: 'To już 9. runda głodu: bohater umrze z wycieńczenia!', en: 'The 9th hungry round: the hero will die of starvation!' })
    : hungerRounds === 3 || hungerRounds === 6
      ? tx({ pl: `To będzie ${hungerRounds}. runda bez jedzenia: stracisz ${hungerRounds === 3 ? 5 : 10} Żyw.!`, en: `That will be round ${hungerRounds} without food: you lose ${hungerRounds === 3 ? 5 : 10} Vitality!` })
      : tx({ pl: `To będzie ${hungerRounds}. runda bez jedzenia. Po 3 rundach głód odbiera 5 Żyw., po 6 kolejne 10.`, en: `That will be round ${hungerRounds} without food. After 3 rounds hunger takes 5 Vitality, after 6 another 10.` });
  return (
    <div className="overlay" onClick={onBack}>
      <motion.article className="card meal-card" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} role="alertdialog">
        <motion.span className="meal-bread" animate={{ rotate: [0, -8, 8, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.8 }}>
          <Icon name="food" size={56} />
        </motion.span>
        <header className="card-head">
          <small>{tx({ pl: 'Koniec rundy', en: 'End of the round' })}</small>
          <h2>{tx({ pl: 'Musisz się posilić', en: 'You need to eat' })}</h2>
        </header>
        <p className="card-text">
          {tx({ pl: `Twój bohater nie zjadł jeszcze posiłku w tej rundzie. Zjedz ${left} ${left === 1 ? 'porcję' : 'porcje'} jedzenia (masz ${food}), żeby nie tracić Żywotności.`, en: `You have not eaten this round. Eat ${left} food (you have ${food}) so you do not lose Vitality.` })}
        </p>
        <p className="card-text"><small>{penalty}</small></p>
        <div className="card-options">
          <button className="eat-big" onClick={onEat}>{tx({ pl: `Zjedz (−${left}) i kontynuuj`, en: `Eat (−${left}) and go on` })}</button>
          <button className="ghost" onClick={onSkip}>{tx({ pl: 'Kontynuuj bez jedzenia', en: 'Go on without eating' })}</button>
        </div>
      </motion.article>
    </div>
  );
}

/** Speed or Stamina as a row of blocks: lit blocks are what the hero has left this turn. */
function MoveBar({ icon, label, left, max, kind }: { icon: IconName; label: string; left: number; max: number; kind: 'speed' | 'stamina' }) {
  const total = Math.max(max, left);
  return (
    <span className={`stat movebar ${kind} ${left === 0 ? 'warn' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={left}>
      <small>{label}</small>
      <b><Icon name={icon} size={14} /> {left}/{max}</b>
      <span className="pips" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <motion.i key={i} className={i < left ? 'on' : ''} initial={false} animate={{ scaleY: i < left ? 1 : 0.55, opacity: i < left ? 1 : 0.35 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} />
        ))}
      </span>
    </span>
  );
}

/** This game's goals, always in sight: what to do, how far along, and the XP each pays. */
function GoalsPanel({ game, me }: { game: GameState; me: PlayerState }) {
  const { t, tx, locale } = useT();
  return (
    <section className="goals" aria-label={locale === 'pl' ? 'Cele gry' : 'Game goals'}>
      <small className="goals-head">{locale === 'pl' ? 'Cele gry' : 'Game goals'}</small>
      {me.character.missions.map((id) => {
        const m = MISSIONS.find((x) => x.id === id);
        if (!m) return null;
        const p = missionProgress(game, me, id);
        return (
          <div key={id} className={`goal ${p.done ? 'done' : ''}`} title={missionGoal(m, game.config.size, locale)}>
            <span className="goal-title"><b>{p.done ? '✓ ' : ''}{tx(m.name)}</b> <small>+{m.xp} {t('xp')}</small></span>
            <small className="goal-text">{missionGoal(m, game.config.size, locale)}</small>
            <span className="goal-bar"><motion.span initial={false} animate={{ width: `${(p.count / p.target) * 100}%` }} /></span>
            <small className="goal-count">{p.count}/{p.target}</small>
          </div>
        );
      })}
      {me.journal && <VowGoals me={me} />}
    </section>
  );
}

/** The hero's vows beside the goals (Jacob, 2026-11-27): at most two at once, with an empty place showing what is free. */
function VowGoals({ me }: { me: PlayerState }) {
  const { tx, locale } = useT();
  const vows = activeVows(me.journal!);
  const pl = locale === 'pl';
  return (
    <>
      <small className="goals-head vows-head">{pl ? `Postanowienia ${vows.length}/${MAX_VOWS}` : `Vows ${vows.length}/${MAX_VOWS}`}</small>
      {vows.map((v) => {
        const def = VOWS.find((d) => d.kind === v.kind);
        if (!def) return null;
        return (
          <div key={v.kind} className="goal vow" title={tx(def.text)}>
            <span className="goal-title"><b><span aria-hidden="true">✒ </span>{tx(def.text)}</b> <small>+{VOW_XP} {pl ? 'PD' : 'XP'}</small></span>
            <span className="goal-bar"><motion.span initial={false} animate={{ width: `${(v.have / v.need) * 100}%` }} /></span>
            <small className="goal-count">{v.have}/{v.need}</small>
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, MAX_VOWS - vows.length) }, (_, i) => (
        <div key={`free-${i}`} className="goal vow free">
          <span className="goal-title"><b>{pl ? 'Wolne postanowienie' : 'Free vow'}</b></span>
          <small className="goal-text">{pl ? 'Złożysz je w obozowisku' : 'Make one at camp'}</small>
        </div>
      ))}
    </>
  );
}

