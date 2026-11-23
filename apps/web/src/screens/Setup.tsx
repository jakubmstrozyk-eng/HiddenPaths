import { useState } from 'react';
import { SIZE_PRESETS, type Difficulty, type GameConfig, type SizePreset, type WinMode } from '@hp/engine';
import { useT, type UiKey } from '../i18n';

export function SetupScreen({ onBack, onNext, multiplayer = false }: {
  onBack: () => void;
  onNext: (c: GameConfig, maxPlayers: number) => void;
  multiplayer?: boolean;
}) {
  const { t } = useT();
  const [players, setPlayers] = useState(2);
  const [size, setSize] = useState<SizePreset>('short');
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

      <h3>{t('mapSize')}</h3>
      <div className="choices">
        {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((s) => {
          const { width, height } = SIZE_PRESETS[s];
          return (
            <Choice key={s} active={size === s} onClick={() => setSize(s)} title={t(s)}>
              {width * height} {t('fragments')} · {width}×{height}
            </Choice>
          );
        })}
      </div>

      <h3>{t('difficulty')}</h3>
      <div className="choices">
        {(['easy', 'normal', 'hard', 'nightmare'] as Difficulty[]).map((d) => (
          <Choice key={d} active={difficulty === d} onClick={() => setDifficulty(d)} title={t(d)} />
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
        <button className="primary" onClick={() => onNext({ size, difficulty, winMode, multiplayer }, multiplayer ? players : 1)}>
          {t('next')}
        </button>
      </div>
    </div>
  );
}

export function Choice(props: { active: boolean; onClick: () => void; title: string; children?: React.ReactNode }) {
  return (
    <button className={`choice ${props.active ? 'active' : ''}`} aria-pressed={props.active} onClick={props.onClick}>
      <strong>{props.title}</strong>
      {props.children && <small>{props.children}</small>}
    </button>
  );
}
