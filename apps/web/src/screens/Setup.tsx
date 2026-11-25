import { useState } from 'react';
import { DIFFICULTIES, sizeForTiles, type Difficulty, type GameConfig, type WinMode } from '@hp/engine';
import { defaultMapChoice, MapSetupPanel, toMapSetup, type MapChoice } from './MapSetup';
import { useT, type UiKey } from '../i18n';

export function SetupScreen({ onBack, onNext, multiplayer = false }: {
  onBack: () => void;
  onNext: (c: GameConfig, maxPlayers: number) => void;
  multiplayer?: boolean;
}) {
  const { t, locale } = useT();
  const [players, setPlayers] = useState(2);
  const [map, setMap] = useState<MapChoice>(defaultMapChoice);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [winMode, setWinMode] = useState<WinMode>('exploration');

  return (
    <div className="panel">
      <h2>{multiplayer ? t('multiplayer') : t('newGame')}</h2>

      {multiplayer && (
        <>
          <h3>{t('players')}</h3>
          <div className="choices">
            {[2, 3, 4].map((n) => (
              <Choice key={n} active={players === n} onClick={() => setPlayers(n)} title={`${n}`} />
            ))}
          </div>
        </>
      )}

      <MapSetupPanel value={map} onChange={setMap} />

      <h3>{t('difficulty')}</h3>
      <div className="choices">
        {(['easy', 'normal', 'hard', 'nightmare'] as Difficulty[]).map((d) => (
          <Choice key={d} active={difficulty === d} onClick={() => setDifficulty(d)} title={t(d)} className="diff" style={{ ['--diff' as string]: DIFF_COLOUR[d] }}>
            {diffNote(d, locale)}
          </Choice>
        ))}
      </div>

      <h3>{t('winMode')}</h3>
      <div className="choices">
        {(['stone', 'exploration'] as WinMode[]).map((m) => (
          <Choice key={m} active={winMode === m} onClick={() => setWinMode(m)} title={t(m)}>
            {t(`${m}Info` as UiKey)}
          </Choice>
        ))}
      </div>

      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="primary" onClick={() => onNext({ size: sizeForTiles(map.tiles), map: toMapSetup(map), difficulty, winMode, multiplayer }, multiplayer ? players : 1)}>
          {t('next')}
        </button>
      </div>
    </div>
  );
}

const DIFF_COLOUR: Record<Difficulty, string> = { easy: '#6ed08a', normal: '#7fb8ff', hard: '#ffb347', nightmare: '#ff5a5a' };

/** What each difficulty changes, read from the engine's own settings. */
function diffNote(d: Difficulty, locale: string) {
  const s = DIFFICULTIES[d];
  const pl = locale === 'pl';
  const parts = [
    s.testModifier ? `${pl ? 'testy' : 'tests'} ${s.testModifier > 0 ? '+' : ''}${s.testModifier}` : null,
    `${pl ? 'wrogowie' : 'foes'} ${Math.round(s.enemyVitality * 100)}% ${pl ? 'Żyw' : 'Vit'}`,
    `${pl ? 'start' : 'start'}: ${s.startFood} ${pl ? 'jedz.' : 'food'}`,
    `PD ×${s.xp}`,
  ];
  return parts.filter(Boolean).join(' · ');
}

export function Choice(props: { active: boolean; onClick: () => void; title: string; children?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <button className={`choice ${props.className ?? ''} ${props.active ? 'active' : ''}`} style={props.style} aria-pressed={props.active} onClick={props.onClick}>
      <strong>{props.title}</strong>
      {props.children && <small>{props.children}</small>}
    </button>
  );
}
