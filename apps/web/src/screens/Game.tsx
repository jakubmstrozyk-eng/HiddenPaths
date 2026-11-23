import { useMemo } from 'react';
import { motion } from 'motion/react';
import { TERRAINS } from '@hp/content';
import { applyAction, currentPlayer, legalActions, type Action, type GameState } from '@hp/engine';
import { useT } from '../i18n';
import { PixelHero } from '../PixelHero';

/** Placeholder terrain colours; pixel-art tiles replace them in a later milestone. */
const TERRAIN_STYLE: Record<string, string> = {
  forest: '#1f4d2b', mountains: '#5b5f6b', fields: '#7d8a3a', river: '#2b5f8a', lake: '#1e4f7a',
  desert: '#b8934a', inn: '#7a4f2a', monument: '#6b5a8a', cave: '#3a3438', village: '#8a6a3a',
  city: '#a08850', core: '#120c22',
};

export function GameScreen({ game, onChange, onMenu }: {
  game: GameState;
  onChange: (g: GameState) => void;
  onMenu: () => void;
}) {
  const { t, tx } = useT();
  const me = currentPlayer(game);
  const c = me.character;
  const { width, height, cells } = game.map;
  const actions = useMemo(() => legalActions(game, me.id), [game, me.id]);
  const moves = new Map(actions.flatMap((a) => (a.type === 'move' ? [[a.to, a] as const] : [])));

  // The fragment revealed by the last action dissolves from the side the hero came in.
  const last = game.log.at(-1);
  const justRevealed = last?.type === 'revealed' || last?.type === 'eventDrawn' ? last.cell : null;
  const origin = (() => {
    if (justRevealed === null || me.cameFrom === null) return { x: '50%', y: '50%' };
    const dx = (me.cameFrom % width) - (justRevealed % width);
    const dy = Math.floor(me.cameFrom / width) - Math.floor(justRevealed / width);
    return { x: `${50 + dx * 50}%`, y: `${50 + dy * 50}%` };
  })();

  const act = (a: Action) => onChange(applyAction(game, me.id, a));
  const here = cells[me.position]!;
  const hereTerrain = here.terrain === 'core' ? null : TERRAINS[here.terrain];

  return (
    <div className="game">
      <header className="hud">
        <button className="ghost small" onClick={onMenu}>{t('menu')}</button>
        <div className="who">
          <PixelHero race={c.race} size={28} />
          <span>
            <b>{c.name}</b> · {t('level')} {c.level} · {t('round')} {game.round}
          </span>
        </div>
        <div className="stats">
          <Stat label={t('speed')} value={`${me.speedLeft}/${c.speed}`} />
          <Stat label={t('stamina')} value={`${me.staminaLeft}/${c.stamina}`} />
          <Stat label={t('vitality')} value={`${c.vitality}/${c.maxVitality}`} />
          <Stat label={t('food')} value={c.food} />
          <Stat label={t('gold')} value={c.gold} />
          <Stat label={t('xp')} value={Math.floor(c.xp)} />
        </div>
      </header>

      <div className="board-wrap">
        <div className="board" style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, aspectRatio: `${width} / ${height}`, ['--ratio' as string]: width / height }}>
          {cells.map((cell) => {
            const seen = me.revealed.includes(cell.index);
            const move = moves.get(cell.index);
            const name = cell.terrain === 'core' ? '?' : tx(TERRAINS[cell.terrain].name);
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
                {cell.index === justRevealed && (
                  <span key={game.version} className="void-wrap dissolving" style={{ ['--ox' as string]: origin.x, ['--oy' as string]: origin.y }}>
                    <span className="void" />
                  </span>
                )}
              </button>
            );
          })}
          <motion.div
            className="hero"
            initial={false}
            animate={{
              left: `${((me.position % width) / width) * 100}%`,
              top: `${(Math.floor(me.position / width) / height) * 100}%`,
            }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
            style={{ width: `${100 / width}%`, height: `${100 / height}%` }}
          >
            <PixelHero race={c.race} size={40} />
          </motion.div>
        </div>
      </div>

      <footer className="dock">
        <p className="here">
          <b>{hereTerrain ? tx(hereTerrain.name) : '?'}</b>
          {justRevealed !== null && last?.type === 'eventDrawn' ? ` · ${t('eventSoon')}` : ` · ${t('tapToMove')}`}
        </p>
        <div className="dock-actions">
          {actions.some((a) => a.type === 'camp') && (
            <button className="ghost" onClick={() => act({ type: 'camp' })}>{t('camp')}</button>
          )}
          <button className="primary" onClick={() => act({ type: 'endTurn' })}>{t('endTurn')}</button>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="stat">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}
