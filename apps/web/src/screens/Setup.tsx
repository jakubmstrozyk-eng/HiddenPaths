import { useState } from 'react';
import { SIZE_PRESETS, type Difficulty, type GameConfig, type SizePreset, type WinMode } from '@hp/engine';
import { useT, type UiKey } from '../i18n';

export function SetupScreen({ onBack, onNext }: { onBack: () => void; onNext: (c: GameConfig) => void }) {
  const { t } = useT();
  const [size, setSize] = useState<SizePreset>('short');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [winMode, setWinMode] = useState<WinMode>('exploration');

  return (
    <div className="panel">
      <h2>{t('newGame')}</h2>

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
        <button className="primary" onClick={() => onNext({ size, difficulty, winMode, multiplayer: false })}>
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
