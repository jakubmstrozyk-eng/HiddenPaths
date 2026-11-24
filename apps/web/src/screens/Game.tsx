import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EVENT_BY_ID, MISSIONS, TERRAINS, type RaceId, type TerrainAction } from '@hp/content';
import {
  applyAction, currentPlayer, entryCell, missionGoal, missionProgress, isOutside, legalActions, newEntries, OUTSIDE, SIDES, successChance, testModifier, worldView,
  type Action, type GameState, type LogEntry, type PlayerState, type Side,
} from '@hp/engine';
import { TerrainArt } from '../TerrainArt';
import { actionInfo } from '../actionInfo';
import { DiceTray } from '../Dice';
import { useT } from '../i18n';
import { combatLine, describe, diceOf, type DiceRoll } from '../logText';
import { PixelHero } from '../PixelHero';
import { EventPanel, StoryPanel } from './Panels';
import { Duel } from './Duel';
import { BagSheet, HeroSheet, TownSheet } from './Sheets';
import { SaveDialog } from './Saves';
import { Tip, type TipId } from '../Tips';
import { Icon, type IconName } from '../Icons';
import { SkillHand } from '../SkillCards';

/** Which side a hero first stands at, before the player picks one: the side nearest their homeland. */
const HOME_SIDE: Record<RaceId, Side> = { humans: 'S', sunborn: 'W', keepers: 'W', flintborn: 'N', nomads: 'N', myrmids: 'E' };

/** How far outside the board the starting places sit, in fragments. */
const GATE_OUT = 0.9;

/** Where a fragment (or a starting place outside the map) sits, in fragments from the board's top-left corner. */
function spot(map: { width: number; height: number }, position: number, gate: Side) {
  if (position !== OUTSIDE) return { x: position % map.width, y: Math.floor(position / map.width) };
  const midX = Math.floor((map.width - 1) / 2);
  const midY = Math.floor((map.height - 1) / 2);
  if (gate === 'N') return { x: midX, y: -GATE_OUT };
  if (gate === 'S') return { x: midX, y: map.height - 1 + GATE_OUT };
  if (gate === 'W') return { x: -GATE_OUT, y: midY };
  return { x: map.width - 1 + GATE_OUT, y: midY };
}

/** The icon shown on a fragment for each thing the hero can do there. */
const TILE_ICONS: Partial<Record<string, IconName>> = {
  hunt: 'hunt', gather: 'gather', herbalism: 'herbalism', mine: 'mine', swim: 'swim', meditate: 'meditate', camp: 'camp', market: 'town', meal: 'food',
};

/** How long the hero takes to walk to the next fragment. */
const WALK_MS = 750;

const TERRAIN_ACTIONS = ['hunt', 'gather', 'herbalism', 'mine', 'swim', 'meditate'] as const satisfies TerrainAction[];

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
  const moves = new Map(actions.flatMap((a) => (a.type === 'move' ? [[a.to, a] as const] : [])));
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
  const boardWidth = Math.max(160, Math.min(room.w * width / (width + 1.8), room.h * width / (height + 1.8), 720));
  const [gate, setGate] = useState<Side>(HOME_SIDE[c.race]);
  const enterable = new Set(actions.flatMap((a) => (a.type === 'enter' ? [a.side] : [])));

  const [last, setLast] = useState<LogEntry[]>([]);
  const [dice, setDice] = useState<DiceRoll[] | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [story, setStory] = useState<{ title: string; lines: string[] } | null>(null);
  const [sheet, setSheet] = useState<'town' | 'bag' | 'hero' | 'save' | null>(null);
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
      const rolls = diceOf(entries, T);
      if (rolls.length) setDice(rolls);
    }

    const nextMe = next.players.find((p) => p.id === me.id)!;
    const inScene = !!(me.pendingEvent || me.combat);
    const drawn = entries.find((e) => e.type === 'eventDrawn');
    const started = entries.find((e) => e.type === 'combatStarted');
    let title = storyTitle;
    let acc = inScene ? [...lines] : [];
    if (drawn && drawn.type === 'eventDrawn') {
      title = tx(EVENT_BY_ID[drawn.card]!.title);
      acc = [];
    } else if (started && !inScene) {
      title = t('fight');
    }
    const fresh = entries.map((e) => (nextMe.combat || me.combat ? combatLine(e, T) : describe(e, T))).filter((l): l is string => !!l);
    acc = [...acc, ...fresh];
    const stillInScene = !!(nextMe.pendingEvent || nextMe.combat);
    if ((inScene || drawn || started) && !stillInScene) {
      setStory({ title, lines: acc });
      setLines([]);
    } else if (stillInScene) {
      setLines(acc);
    } else if (entries.some((e) => e.type === 'died' || e.type === 'levelUp' || e.type === 'stoneTaken' || e.type === 'mission')) {
      // Plain actions only open a card for big moments: death, a new level, the Stone.
      const terrain = cells[nextMe.position]?.terrain ?? 'core';
      setStory({ title: terrain === 'core' ? tx({ pl: 'Kamień początku', en: 'Stone of Beginnings' }) : tx(TERRAINS[terrain].name), lines: fresh });
    }
    setStoryTitle(title);
    onChange(next);
    void submit?.(game, a);
  }, [game, me, lines, storyTitle, T, t, tx, cells, onChange, submit]);

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

  const here = outside ? null : cells[me.position]!;
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
    <div className="game">
      <header className="hud">
        <button className="ghost small with-icon" onClick={onMenu}><Icon name="menu" />{t('menu')}</button>
        {canSave && (
          <button className="ghost small with-icon" onClick={() => setSheet('save')} title={tx({ pl: 'Zapisz grę', en: 'Save game' })}>
            <Icon name="save" />{tx({ pl: 'Zapisz grę', en: 'Save game' })}
          </button>
        )}
        <div className="who">
          <PixelHero race={c.race} profession={c.profession} look={c.look} size={28} />
          <span>
            <b>{c.name}</b> · {t('level')} {c.level} · {t('round')} {game.round}
          </span>
        </div>
        <div className="stats">
          <MoveBar icon="speed" label={t('speed')} left={me.speedLeft} max={c.speed} kind="speed" />
          <MoveBar icon="stamina" label={t('stamina')} left={me.staminaLeft} max={c.stamina} kind="stamina" />
          <Stat icon="vitality" label={t('vitality')} value={`${c.vitality}/${c.maxVitality}`} warn={c.vitality <= c.maxVitality / 3} />
          <FoodBar food={c.food} meals={mealsToday(game, me)} label={t('food')} />
          <Stat icon="gold" label={t('gold')} value={Number.isInteger(c.gold) ? c.gold : c.gold.toFixed(2)} />
          <Stat icon="xp" label={t('xp')} value={Math.floor(c.xp)} />
        </div>
      </header>

      <GoalsPanel game={game} me={me} />

      <div className="play-area">
        <div className="board-wrap" ref={wrapRef}>
          <div className="board" style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width} / ${height}`, width: boardWidth }}>
            {cells.map((cell) => {
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
                  className={`frag ${move ? 'reachable' : ''} ${isHere ? 'here-tile' : ''} ${seen ? 'seen' : ''}`}
                  disabled={!move}
                  onClick={() => move && act(move)}
                  aria-label={seen ? name : move ? `${t('tapToMove')}` : undefined}
                >
                  {seen && <TerrainArt terrain={cell.terrain} seed={cell.index} />}
                  {seen && <span className="frag-name">{name}</span>}
                  {icons.length > 0 && (
                    <span className="frag-icons">{icons.map((i) => <Icon key={i} name={i} size={16} />)}</span>
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
                  <PixelHero race={p.character.race} profession={p.character.profession} look={p.character.look} size={28} />
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
                <PixelHero race={c.race} profession={c.profession} look={c.look} size={40} walking={walking} facing={facing} />
              </span>
            </motion.div>
          </div>
        </div>
        <aside className="frag-panel" aria-label={tx({ pl: 'Na tym fragmencie', en: 'On this fragment' })}>
          <p className="here">
            <Icon name="map" size={14} /> <b>{outside ? t('beforeMap') : hereTerrain ? tx(hereTerrain.name) : tx({ pl: 'Kamień początku', en: 'Stone of Beginnings' })}</b>
            {outside ? ` · ${t('pickSide')}` : me.hasStone ? ` · ${t('stoneCarried')}` : lastNote ? ` · ${lastNote}` : ` · ${t('tapToMove')}`}
          </p>
          <small className="frag-panel-head">{tx({ pl: 'Co możesz tu zrobić', en: 'What you can do here' })}</small>
          <div className="frag-actions">
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
            {inTown && quiet && (
              <button className="ghost act-btn town-btn" onClick={() => setSheet('town')}>
                <span className="act-title"><Icon name="town" size={14} />{tx({ pl: 'Wejdź', en: 'Go in' })}: {hereTerrain ? tx(hereTerrain.name) : t('town')}</span>
                <small className="act-reward">{here?.terrain === 'inn' ? tx({ pl: 'szynk, stół podróżnych, pokoje', en: 'bar, travellers\' table, rooms' }) : tx({ pl: 'karczma, kuźnia, plac, targ, kupiec', en: 'tavern, smithy, yard, market, merchant' })}</small>
              </button>
            )}
            {myTurn && actions.some((a) => a.type === 'camp') && (
              <button className="ghost with-icon" onClick={() => act({ type: 'camp' })}><Icon name="camp" />{t('camp')}</button>
            )}
            {myTurn && actions.some((a) => a.type === 'camp' && a.research) && (
              <button className="ghost with-icon" onClick={() => act({ type: 'camp', research: true })}><Icon name="cards" />{t('campResearch')} <small className="odds">+1 Int</small></button>
            )}
            <button className="primary end-turn" disabled={!quiet} onClick={() => act({ type: 'endTurn' })}>
              {t('endTurn')}
              <small>{mealNote(mealsToday(game, me), c.food, locale)}</small>
            </button>
          </div>
        </aside>
      </div>

      <footer className="dock">
        {!myTurn && !game.winner && (
          <p className="waiting">
            {locale === 'pl' ? `Ruch gracza ${names[turnOf.id] ?? turnOf.character.name}` : `${names[turnOf.id] ?? turnOf.character.name} is playing`}
            {hoursLeft !== null ? (locale === 'pl' ? ` · zostało ok. ${hoursLeft} h` : ` · about ${hoursLeft} h left`) : ''}
          </p>
        )}
        <SkillHand
          profession={c.profession}
          owned={c.cards}
          actor={me}
          playable={quiet ? actions.flatMap((a) => (a.type === 'card' ? [a.card] : [])) : []}
          onPlay={(card) => act({ type: 'card', card })}
        />
        <div className="dock-actions">
          <button className={`ghost with-icon ${c.unspentPoints > 0 ? 'badge' : ''}`} disabled={!quiet} onClick={() => setSheet('hero')}><Icon name="xp" />{t('heroSheet')}</button>
          <button className="ghost with-icon" disabled={!quiet} onClick={() => setSheet('bag')}><Icon name="bag" />{t('bag')}</button>
        </div>
      </footer>

      <AnimatePresence>
        {!onTheWay && me.pendingEvent && !me.combat && <EventPanel key="event" game={game} me={me} lines={lines} act={act} />}
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
        {!onTheWay && !replay && story && !me.pendingEvent && !me.combat && <StoryPanel key="story" title={story.title} lines={story.lines} onClose={() => setStory(null)} />}
        {sheet === 'town' && quiet && <TownSheet key="town" game={game} me={me} act={act} onClose={() => setSheet(null)} />}
        {sheet === 'bag' && quiet && <BagSheet key="bag" game={game} me={me} act={act} onClose={() => setSheet(null)} />}
        {sheet === 'save' && <SaveDialog key="save" game={game} onClose={() => setSheet(null)} />}
        {sheet === 'hero' && quiet && <HeroSheet key="hero" game={game} me={me} act={act} onClose={() => setSheet(null)} />}
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
        {dice && <DiceTray key={`dice-${game.version}`} rolls={dice} dice={c.dice} onDone={() => setDice(null)} />}
      </AnimatePresence>
      {myTurn && !game.winner && !dice && !story && <Tip candidates={tipsFor()} />}
    </div>
  );
}

function Stat({ icon, label, value, warn }: { icon: IconName; label: string; value: string | number; warn?: boolean }) {
  return (
    <span className={`stat ${warn ? 'warn' : ''}`}>
      <small>{label}</small>
      <b><Icon name={icon} size={14} /> {value}</b>
    </span>
  );
}

/** Food the hero eats when this turn ends: 0 for the Sunborn on an even round, 2 in the desert, else 1. Mirrors endTurn in the engine. */
function mealsToday(game: GameState, me: PlayerState): number {
  if (me.character.race === 'sunborn' && game.round % 2 === 0) return 0;
  return !isOutside(me) && game.map.cells[me.position]!.terrain === 'desert' ? 2 : 1;
}

/** What the end of the turn does to the food bag, in words. */
function mealNote(meals: number, food: number, locale: string): string {
  const pl = locale === 'pl';
  if (meals === 0) return pl ? 'dziś bez posiłku' : 'no meal today';
  if (food < meals) return pl ? 'brak jedzenia: głód!' : 'no food: hunger!';
  return pl ? `−${meals} jedzenia` : `−${meals} food`;
}

/** Food as a row of rations; the ones the hero eats at the end of the turn are marked. */
function FoodBar({ food, meals, label }: { food: number; meals: number; label: string }) {
  const { locale } = useT();
  const pl = locale === 'pl';
  const shown = Math.min(food, 12);
  const days = meals === 0 ? null : Math.floor(food / Math.max(1, meals));
  return (
    <span className={`stat movebar food ${food < Math.max(1, meals) ? 'warn' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuenow={food}>
      <small>{label} · {meals === 0 ? (pl ? 'dziś bez posiłku' : 'no meal today') : `−${meals}/${pl ? 'dzień' : 'day'}`}</small>
      <b><Icon name="food" size={14} /> {food}{days !== null ? <em className="food-days">{pl ? ` · na ${days} ${days === 1 ? 'dzień' : 'dni'}` : ` · ${days} ${days === 1 ? 'day' : 'days'}`}</em> : null}</b>
      <span className="pips" aria-hidden="true">
        {food === 0 && <i className="empty" />}
        {Array.from({ length: shown }, (_, i) => (
          <motion.i key={i} className={`on ${i >= shown - meals ? 'eaten' : ''}`} initial={false} animate={{ scaleY: 1, opacity: 1 }} />
        ))}
        {food > shown && <small className="more">+{food - shown}</small>}
      </span>
    </span>
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
    </section>
  );
}

