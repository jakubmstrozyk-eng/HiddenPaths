import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EVENT_BY_ID, TERRAINS, type TerrainAction } from '@hp/content';
import {
  applyAction, currentPlayer, legalActions, newEntries, successChance, testModifier, worldView,
  type Action, type GameState, type LogEntry, type PlayerState,
} from '@hp/engine';
import { DiceTray } from '../Dice';
import { useT } from '../i18n';
import { combatLine, describe, diceOf, type DiceRoll } from '../logText';
import { PixelHero } from '../PixelHero';
import { EventPanel, StoryPanel } from './Panels';
import { Duel } from './Duel';
import { BagSheet, TownSheet } from './Sheets';
import { Tip, type TipId } from '../Tips';
import { Icon, type IconName } from '../Icons';
import { SkillHand } from '../SkillCards';

/** Placeholder terrain colours; pixel-art tiles replace them in a later milestone. */
const TERRAIN_STYLE: Record<string, string> = {
  forest: '#1f4d2b', mountains: '#5b5f6b', fields: '#7d8a3a', river: '#2b5f8a', lake: '#1e4f7a',
  desert: '#b8934a', inn: '#7a4f2a', monument: '#6b5a8a', cave: '#3a3438', village: '#8a6a3a',
  city: '#a08850', core: '#120c22',
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

export function GameScreen({ game, onChange, onMenu, onNew, meId, submit, names = {}, deadline }: {
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

  const [last, setLast] = useState<LogEntry[]>([]);
  const [dice, setDice] = useState<DiceRoll[] | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [story, setStory] = useState<{ title: string; lines: string[] } | null>(null);
  const [sheet, setSheet] = useState<'town' | 'bag' | null>(null);
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
    const dx = (me.position % width) - (from % width);
    if (dx !== 0) setFacing(dx > 0 ? 1 : -1);
    setWalking(true);
    const timer = setTimeout(() => setWalking(false), WALK_MS);
    return () => clearTimeout(timer);
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
    } else if (entries.some((e) => e.type === 'died' || e.type === 'levelUp' || e.type === 'stoneTaken')) {
      // Plain actions only open a card for big moments: death, a new level, the Stone.
      const terrain = cells[nextMe.position]!.terrain;
      setStory({ title: terrain === 'core' ? tx({ pl: 'Kamień początku', en: 'Stone of Beginnings' }) : tx(TERRAINS[terrain].name), lines: fresh });
    }
    setStoryTitle(title);
    onChange(next);
    void submit?.(game, a);
  }, [game, me, lines, storyTitle, T, t, tx, cells, onChange, submit]);

  // Fragments revealed by the last action dissolve from the side the hero came in.
  const revealedNow = new Set(last.flatMap((e) => (e.type === 'revealed' ? [e.cell] : [])));
  const origin = (cell: number) => {
    if (me.cameFrom === null || cell !== me.position) return { x: '50%', y: '50%' };
    const dx = (me.cameFrom % width) - (cell % width);
    const dy = Math.floor(me.cameFrom / width) - Math.floor(cell / width);
    return { x: `${50 + dx * 50}%`, y: `${50 + dy * 50}%` };
  };

  const here = cells[me.position]!;
  const hereTerrain = here.terrain === 'core' ? null : TERRAINS[here.terrain];
  const terrainActs = actions.flatMap((a) => (a.type === 'terrain' ? [a.action] : []));
  const inTown = here.terrain === 'inn' || here.terrain === 'village' || here.terrain === 'city';
  const quiet = myTurn && !me.pendingEvent && !me.combat && !game.winner;
  const others = game.players.filter((p) => p.id !== me.id);
  const hoursLeft = deadline ? Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000)) : null;
  const tipsFor = (): TipId[] => {
    if (me.combat) return ['combat'];
    if (me.pendingEvent) return ['event'];
    if (sheet) return [];
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
        <div className="who">
          <PixelHero race={c.race} profession={c.profession} look={c.look} size={28} />
          <span>
            <b>{c.name}</b> · {t('level')} {c.level} · {t('round')} {game.round}
          </span>
        </div>
        <div className="stats">
          <Stat icon="speed" label={t('speed')} value={`${me.speedLeft}/${c.speed}`} />
          <Stat icon="stamina" label={t('stamina')} value={`${me.staminaLeft}/${c.stamina}`} />
          <Stat icon="vitality" label={t('vitality')} value={`${c.vitality}/${c.maxVitality}`} warn={c.vitality <= c.maxVitality / 3} />
          <Stat icon="food" label={t('food')} value={c.food} warn={c.food === 0} />
          <Stat icon="gold" label={t('gold')} value={Number.isInteger(c.gold) ? c.gold : c.gold.toFixed(2)} />
          <Stat icon="xp" label={t('xp')} value={Math.floor(c.xp)} />
        </div>
      </header>

      <div className="board-wrap">
        <div className="board" style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width} / ${height}`, ['--ratio' as string]: width / height }}>
          {cells.map((cell) => {
            const seen = me.revealed.includes(cell.index);
            const move = quiet ? moves.get(cell.index) : undefined;
            const name = cell.terrain === 'core' ? (me.hasStone ? '◇' : '◆') : tx(TERRAINS[cell.terrain].name);
            const o = origin(cell.index);
            return (
              <button
                key={cell.index}
                className={`frag ${move ? 'reachable' : ''}`}
                style={{ background: TERRAIN_STYLE[cell.terrain] }}
                disabled={!move}
                onClick={() => move && act(move)}
                aria-label={seen ? name : move ? `${t('tapToMove')}` : undefined}
              >
                {seen && <span className="frag-name">{name}</span>}
                {seen && cell.terrain !== 'core' && TERRAINS[cell.terrain].hard && <span className="frag-hard">2</span>}
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
          {others.map((p) => (
            <motion.div
              key={p.id}
              className="hero other"
              initial={false}
              animate={{ left: `${((p.position % width) / width) * 100}%`, top: `${(Math.floor(p.position / width) / height) * 100}%` }}
              transition={{ type: 'spring', stiffness: 160, damping: 20 }}
              style={{ width: `${100 / width}%`, height: `${100 / height}%` }}
              title={names[p.id] ?? p.character.name}
            >
              <PixelHero race={p.character.race} profession={p.character.profession} look={p.character.look} size={28} />
              <small className="hero-tag">{p.character.name}</small>
            </motion.div>
          ))}
          <motion.div
            className="hero"
            initial={false}
            animate={{
              left: `${((me.position % width) / width) * 100}%`,
              top: `${(Math.floor(me.position / width) / height) * 100}%`,
            }}
            transition={{ duration: WALK_MS / 1000, ease: 'linear' }}
            style={{ width: `${100 / width}%`, height: `${100 / height}%` }}
          >
            <PixelHero race={c.race} profession={c.profession} look={c.look} size={40} walking={walking} facing={facing} />
          </motion.div>
        </div>
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
        <p className="here">
          <Icon name="map" size={14} /> <b>{hereTerrain ? tx(hereTerrain.name) : tx({ pl: 'Kamień początku', en: 'Stone of Beginnings' })}</b>
          {me.hasStone ? ` · ${t('stoneCarried')}` : lastNote ? ` · ${lastNote}` : ` · ${t('tapToMove')}`}
        </p>
        <div className="dock-actions">
          {TERRAIN_ACTIONS.filter((a) => terrainActs.includes(a)).map((a) => (
            <button key={a} className="ghost" onClick={() => act({ type: 'terrain', action: a })}>
              {t(a)}{a !== 'meditate' && <small className="odds"> {Math.round(actionChance(game, me, a) * 100)}%</small>}
            </button>
          ))}
          {inTown && quiet && <button className="ghost with-icon" onClick={() => setSheet('town')}><Icon name="town" />{t('town')}</button>}
          <button className={`ghost with-icon ${c.unspentPoints > 0 ? 'badge' : ''}`} disabled={!quiet} onClick={() => setSheet('bag')}><Icon name="bag" />{t('bag')}</button>
          {myTurn && actions.some((a) => a.type === 'camp') && (
            <button className="ghost with-icon" onClick={() => act({ type: 'camp' })}><Icon name="camp" />{t('camp')}</button>
          )}
          {myTurn && actions.some((a) => a.type === 'camp' && a.research) && (
            <button className="ghost with-icon" onClick={() => act({ type: 'camp', research: true })}><Icon name="cards" />{t('campResearch')} <small className="odds">+1 Int</small></button>
          )}
          <button className="primary" disabled={!quiet} onClick={() => act({ type: 'endTurn' })}>{t('endTurn')}</button>
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
        {dice && <DiceTray key={`dice-${game.version}`} rolls={dice} onDone={() => setDice(null)} />}
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
