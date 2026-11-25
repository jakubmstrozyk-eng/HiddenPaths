import { useMemo } from 'react';
import { TERRAINS, TERRAIN_IDS, type TerrainId } from '@hp/content';
import {
  adjustPool, BUILDING_IDS, buildingCap, fitPool, generateMap, MAP_SHAPES, MAX_TILES, MIN_TILES, openGroundMin, OPEN_GROUND, Rng, shapeLayout,
  sizeForTiles, terrainLimits, terrainPool, type MapSetup, type MapShape,
} from '@hp/engine';
import { TerrainArt } from '../TerrainArt';
import { useT, type UiKey } from '../i18n';

/** Quick picks: the four classic sizes. */
const PRESET_TILES = [25, 36, 49, 64];

const SHAPE_NAMES: Record<MapShape, { pl: string; en: string }> = {
  square: { pl: 'Kwadrat', en: 'Square' },
  rectangle: { pl: 'Prostokąt', en: 'Rectangle' },
  rhombus: { pl: 'Romb', en: 'Rhombus' },
  circle: { pl: 'Koło', en: 'Circle' },
  pentagon: { pl: 'Pięciokąt', en: 'Pentagon' },
  hexagon: { pl: 'Sześciokąt', en: 'Hexagon' },
};

/** The game's own suggestions, shown highlighted and chosen at the start. */
export const RECOMMENDED_SHAPE: MapShape = 'square';
export const RECOMMENDED_TILES = 25;

export interface MapChoice {
  tiles: number;
  shape: MapShape;
  /** Null: the game's recommended mix for this many fragments. */
  pool: Record<TerrainId, number> | null;
}

export const defaultMapChoice = (): MapChoice => ({ tiles: RECOMMENDED_TILES, shape: RECOMMENDED_SHAPE, pool: null });

export function toMapSetup(c: MapChoice): MapSetup {
  return c.pool ? { tiles: c.tiles, shape: c.shape, terrain: c.pool } : { tiles: c.tiles, shape: c.shape };
}

/** A small drawing of an outline: one square per fragment. */
function ShapePreview({ shape, tiles, size = 64 }: { shape: MapShape; tiles: number; size?: number }) {
  const l = useMemo(() => shapeLayout(shape, tiles), [shape, tiles]);
  const cell = size / Math.max(l.width, l.height);
  return (
    <span className="shape-preview" style={{ width: cell * l.width, height: cell * l.height, gridTemplateColumns: `repeat(${l.width}, 1fr)` }} aria-hidden="true">
      {l.inside.map((v, i) => <i key={i} className={v ? (l.ring[i] === 0 ? 'mid' : '') : 'off'} />)}
    </span>
  );
}

export function MapSetupPanel({ value, onChange }: { value: MapChoice; onChange: (c: MapChoice) => void }) {
  const { t, tx, locale } = useT();
  const { tiles, shape } = value;
  const slots = tiles - 1;
  const recommended = useMemo(() => terrainPool(slots), [slots]);
  const pool = value.pool ?? recommended;
  const limits = terrainLimits(slots);
  const buildings = BUILDING_IDS.reduce((s, id) => s + pool[id], 0);
  const open = OPEN_GROUND.reduce((s, id) => s + pool[id], 0);

  const setTiles = (n: number) => {
    const next = Math.round(Math.min(MAX_TILES, Math.max(MIN_TILES, Number.isFinite(n) ? n : MIN_TILES)));
    // Own mix: kept in the same proportions on the new size.
    onChange({ ...value, tiles: next, pool: value.pool ? fitPool(next - 1, value.pool) : null });
  };
  const change = (id: TerrainId, delta: 1 | -1) => {
    const next = adjustPool(slots, pool, id, delta);
    if (!next) return;
    const same = TERRAIN_IDS.every((x) => next[x] === recommended[x]);
    onChange({ ...value, pool: same ? null : next });
  };

  // A sample of how the mix spreads over the outline. The real map is drawn anew for each game.
  const sample = useMemo(() => generateMap({ tiles, shape, terrain: pool }, new Rng(tiles * 31 + MAP_SHAPES.indexOf(shape))), [tiles, shape, pool]);

  const row = (id: TerrainId) => {
    const n = pool[id];
    const rec = recommended[id];
    const canUp = !!adjustPool(slots, pool, id, 1);
    const canDown = !!adjustPool(slots, pool, id, -1);
    const name = tx(TERRAINS[id].name);
    return (
      <div key={id} className={`terrain-row ${n === rec ? 'is-rec' : 'is-own'}`}>
        <span className="terrain-swatch"><TerrainArt terrain={id} seed={TERRAIN_IDS.indexOf(id) * 7} /></span>
        <span className="terrain-name">
          {name}
          <small>{n === rec ? tx({ pl: 'zalecane', en: 'recommended' }) : `${tx({ pl: 'zalecane', en: 'recommended' })}: ${rec}`}{limits[id].min > 0 ? ` · min. ${limits[id].min}` : ''}</small>
        </span>
        <button className="step" onClick={() => change(id, -1)} disabled={!canDown} aria-label={`${name} −1`}>−</button>
        <strong className="terrain-count">{n}</strong>
        <button className="step" onClick={() => change(id, 1)} disabled={!canUp} aria-label={`${name} +1`}>+</button>
      </div>
    );
  };

  return (
    <div className="map-setup">
      <h3>{t('mapSize')}</h3>
      <div className="tiles-pick">
        <div className="choices tiles-presets">
          {PRESET_TILES.map((n) => (
            <button key={n} className={`choice ${tiles === n ? 'active' : ''} ${n === RECOMMENDED_TILES ? 'recommended' : ''}`} aria-pressed={tiles === n} onClick={() => setTiles(n)}>
              <strong>{n}</strong>
              <small>{t(sizeForTiles(n) as UiKey)}{n === RECOMMENDED_TILES ? ` · ${tx({ pl: 'zalecane', en: 'recommended' })}` : ''}</small>
            </button>
          ))}
        </div>
        <label className="tiles-own">
          <span>{tx({ pl: 'Własna liczba fragmentów', en: 'Your own number of fragments' })} <small className="muted">({MIN_TILES}–{MAX_TILES})</small></span>
          <span className="tiles-inputs">
            <input type="range" min={MIN_TILES} max={MAX_TILES} value={tiles} onChange={(e) => setTiles(Number(e.target.value))} aria-label={t('fragments')} />
            <input type="number" min={MIN_TILES} max={MAX_TILES} value={tiles} onChange={(e) => setTiles(Number(e.target.value))} aria-label={t('fragments')} />
          </span>
          <small className="muted">
            {tiles} {t('fragments')} · {t(sizeForTiles(tiles) as UiKey)} {tx({ pl: 'gra', en: 'game' })} · {tx({ pl: 'w tym Kamień początku w środku', en: 'the Stone of Beginnings in the middle included' })}
          </small>
        </label>
      </div>

      <h3>{tx({ pl: 'Kształt mapy', en: 'Map shape' })}</h3>
      <div className="choices shapes">
        {MAP_SHAPES.map((s) => (
          <button key={s} className={`choice shape-choice ${shape === s ? 'active' : ''} ${s === RECOMMENDED_SHAPE ? 'recommended' : ''}`} aria-pressed={shape === s} onClick={() => onChange({ ...value, shape: s })}>
            <ShapePreview shape={s} tiles={tiles} />
            <strong>{tx(SHAPE_NAMES[s])}</strong>
            {s === RECOMMENDED_SHAPE && <small>{tx({ pl: 'zalecany', en: 'recommended' })}</small>}
          </button>
        ))}
      </div>

      <h3>
        {tx({ pl: 'Tereny', en: 'Terrain' })}{' '}
        <span className={`mix-badge ${value.pool ? 'own' : 'rec'}`}>{value.pool ? tx({ pl: 'własny układ', en: 'your own mix' }) : tx({ pl: 'zalecane przez grę', en: 'recommended by the game' })}</span>
      </h3>
      <p className="muted terrain-hint">
        {tx({
          pl: `Dodany fragment gra zabiera z najliczniejszego krajobrazu, a zabrany zamienia w las. Budynków najwyżej ${buildingCap(slots)}, lasu i pól razem co najmniej ${openGroundMin(slots)}.`,
          en: `An added fragment is taken from the most plentiful landscape; a removed one becomes forest. At most ${buildingCap(slots)} buildings, and at least ${openGroundMin(slots)} forest and fields together.`,
        })}
      </p>
      <div className="terrain-editor">
        <div className="terrain-groups">
          <div className="terrain-group">
            <small className="group-head">{tx({ pl: 'Krajobraz', en: 'Landscape' })} <span className={open < openGroundMin(slots) ? 'warn' : ''}>· {tx({ pl: 'las i pola', en: 'forest and fields' })} {open}</span></small>
            {TERRAIN_IDS.filter((id) => !BUILDING_IDS.includes(id)).map(row)}
          </div>
          <div className="terrain-group">
            <small className="group-head">{tx({ pl: 'Budynki', en: 'Buildings' })} · {buildings}/{buildingCap(slots)}</small>
            {BUILDING_IDS.map(row)}
            {value.pool && (
              <button className="ghost restore" onClick={() => onChange({ ...value, pool: null })}>{tx({ pl: 'Przywróć zalecane', en: 'Restore recommended' })}</button>
            )}
          </div>
        </div>
        <figure className="map-sample">
          <div className="sample-board" style={{ gridTemplateColumns: `repeat(${sample.width}, 1fr)`, aspectRatio: `${sample.width} / ${sample.height}` }}>
            {sample.cells.map((c) => (c.terrain === 'void'
              ? <i key={c.index} className="off" />
              : <i key={c.index} title={c.terrain === 'core' ? (locale === 'pl' ? 'Kamień początku' : 'Stone of Beginnings') : tx(TERRAINS[c.terrain].name)}><TerrainArt terrain={c.terrain} seed={c.index} /></i>))}
          </div>
          <figcaption className="muted">{tx({ pl: 'Przykładowe rozłożenie. W grze mapa losuje się na nowo i jest zakryta.', en: 'A sample spread. In the game the map is drawn anew and hidden.' })}</figcaption>
        </figure>
      </div>
    </div>
  );
}
