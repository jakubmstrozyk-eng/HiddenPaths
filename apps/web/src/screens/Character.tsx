import { useMemo, useState } from 'react';
import { ATTRIBUTES, MISSIONS, PROFESSIONS, RACES, RACE_IDS, type Attribute, type ProfessionId, type RaceId } from '@hp/content';
import {
  BONUS_POINTS, MISSIONS_KEPT, Rng, drawMissionChoices, seedFromString, validateCharacter,
  type CharacterInput, type GameConfig,
} from '@hp/engine';
import { useT } from '../i18n';
import { PixelHero } from '../PixelHero';
import { Choice } from './Setup';

export function CharacterScreen({ config, onBack, onStart }: {
  config: GameConfig;
  onBack: () => void;
  /** Creates the game (locally or on the server). A thrown error is shown under the button. */
  onStart: (character: CharacterInput, seed: string) => void | Promise<void>;
}) {
  const { t, tx } = useT();
  const seed = useMemo(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, []);
  const offered = useMemo(() => drawMissionChoices(new Rng(seedFromString(`${seed}:missions`))), [seed]);

  const [name, setName] = useState('');
  const [race, setRace] = useState<RaceId>('keepers');
  const [profession, setProfession] = useState<ProfessionId>('wraith');
  const [bonus, setBonus] = useState<Record<Attribute, number>>({ dex: 0, cha: 0, str: 0, wil: 0, int: 0, com: 0 });
  const [missions, setMissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const spent = Object.values(bonus).reduce((a, b) => a + b, 0);
  const left = BONUS_POINTS - spent;
  const professions = Object.values(PROFESSIONS).filter((p) => p.race === race);

  const pickRace = (r: RaceId) => {
    setRace(r);
    setProfession(Object.values(PROFESSIONS).find((p) => p.race === r && p.mvp)!.id);
  };
  const adjust = (a: Attribute, delta: number) => {
    const next = bonus[a] + delta;
    if (next < 0 || (delta > 0 && left < delta)) return;
    setBonus({ ...bonus, [a]: next });
  };
  const toggleMission = (id: string) => {
    if (missions.includes(id)) setMissions(missions.filter((m) => m !== id));
    else if (missions.length < MISSIONS_KEPT) setMissions([...missions, id]);
  };

  const [busy, setBusy] = useState(false);
  const start = async () => {
    const character: CharacterInput = { name: name.trim(), race, profession, bonus, missions };
    try {
      validateCharacter(character);
      setBusy(true);
      await onStart(character, seed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  void config;
  const ready = name.trim().length > 0 && missions.length === MISSIONS_KEPT;
  const r = RACES[race];

  return (
    <div className="panel">
      <h2>{t('race')}</h2>
      <div className="choices races">
        {RACE_IDS.map((id) => (
          <button key={id} className={`choice race ${race === id ? 'active' : ''}`} aria-pressed={race === id} onClick={() => pickRace(id)}>
            <PixelHero race={id} size={40} />
            <strong>{tx(RACES[id].name)}</strong>
          </button>
        ))}
      </div>
      <ul className="passives">
        {r.passives.map((p, i) => <li key={i}>{tx(p)}</li>)}
        <li>
          {t('speed')} {r.speed} · {t('stamina')} {r.stamina} · {t('vitality')} {r.vitality}
        </li>
      </ul>

      <h3>{t('profession')}</h3>
      <div className="choices">
        {professions.map((p) => (
          <button
            key={p.id}
            className={`choice ${profession === p.id ? 'active' : ''}`}
            disabled={!p.mvp}
            aria-pressed={profession === p.id}
            onClick={() => setProfession(p.id)}
          >
            <strong>{tx(p.name)}</strong>
            <small>{p.mvp ? p.cards.map((c) => tx(c.name)).join(' · ') : t('soon')}</small>
          </button>
        ))}
      </div>

      <h3>
        {t('attributes')} <span className="muted">· {t('pointsLeft')}: {left}</span>
      </h3>
      <div className="attrs">
        {ATTRIBUTES.map((a) => (
          <div key={a} className="attr">
            <span>{t(a)}</span>
            <button aria-label={`- ${t(a)}`} onClick={() => adjust(a, -5)} disabled={bonus[a] === 0}>−</button>
            <b>{r.attributes[a] + bonus[a]}</b>
            <button aria-label={`+ ${t(a)}`} onClick={() => adjust(a, 5)} disabled={left < 5}>+</button>
          </div>
        ))}
      </div>

      <h3>{t('missions')}</h3>
      <div className="choices">
        {offered.map((id) => {
          const m = MISSIONS.find((x) => x.id === id)!;
          return (
            <Choice key={id} active={missions.includes(id)} onClick={() => toggleMission(id)} title={`${tx(m.name)} · +${m.xp} ${t('xp')}`}>
              {tx(m.goal)}
            </Choice>
          );
        })}
      </div>

      <h3>{t('name')}</h3>
      <input className="name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Ara" />

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="primary" disabled={!ready || busy} onClick={start}>{t('start')}</button>
      </div>
    </div>
  );
}
