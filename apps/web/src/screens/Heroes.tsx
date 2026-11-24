import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ATTRIBUTES, DEFAULT_DICE, DEFAULT_LOOK, DICE_STYLES, LOOK_NAMES, LOOK_OPTIONS, MISSIONS, PROFESSIONS, RACES,
  type Attribute, type DiceLook, type HeroLook, type ProfessionId, type RaceId,
} from '@hp/content';
import {
  BONUS_POINTS, MISSIONS_KEPT, Rng, careerProgress, drawMissionChoices, missionGoal, type SizePreset, heroFits, seedFromString, validateHero, type Hero,
} from '@hp/engine';
import { DieFace, diceStyle } from '../DiceFace';
import type { HeroStore } from '../heroStore';
import { useT } from '../i18n';
import { PixelHero } from '../PixelHero';
import { WorldMap } from '../WorldMap';
import { Choice } from './Setup';

/* ------------------------------------------------------------------------------------------ */
/* The list of heroes                                                                          */
/* ------------------------------------------------------------------------------------------ */

function useHeroes(store: HeroStore) {
  const [heroes, setHeroes] = useState<Hero[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => store.list().then(setHeroes, (e) => setError((e as Error).message));
  useEffect(() => {
    reload();
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps
  return { heroes, error, reload };
}

export function HeroCard({ hero, active, onClick, children }: { hero: Hero; active?: boolean; onClick?: () => void; children?: React.ReactNode }) {
  const { t, tx } = useT();
  return (
    <div className={`hero-card ${active ? 'active' : ''} ${onClick ? 'pickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined} aria-pressed={onClick ? !!active : undefined}>
      <div className="hero-card-avatar"><PixelHero race={hero.race} profession={hero.profession} look={hero.look} size={72} /></div>
      <div className="hero-card-body">
        <b>{hero.name}</b>
        <small>{tx(RACES[hero.race].name)} · {tx(PROFESSIONS[hero.profession].name)}</small>
        <span className={`mode-badge ${hero.mode}`}>{hero.mode === 'solo' ? t('heroSolo') : t('heroMulti')}</span>
        <span className="hero-dice">
          {(['d6', 'd10', 'd100'] as const).map((k) => <DieFace key={k} kind={k} value={k === 'd6' ? 6 : 7} style={diceStyle(hero.dice[k])} size={22} />)}
        </span>
        <CareerBadges hero={hero} />
      </div>
      {children}
    </div>
  );
}

/** Career goals across all the hero's games: a title once reached, otherwise how far along. */
export function CareerBadges({ hero }: { hero: Hero }) {
  const { tx, locale } = useT();
  const progress = careerProgress(Object.values(hero.career ?? {}));
  return (
    <span className="career" title={locale === 'pl' ? 'Cele kariery' : 'Career goals'}>
      {progress.map((p) => {
        const m = MISSIONS.find((x) => x.id === p.id)!;
        return (
          <span key={p.id} className={`career-badge ${p.done ? 'done' : ''}`} title={missionGoal(m, 'short', locale)}>
            {p.done ? `★ ${tx(m.title ?? m.name)}` : `${tx(m.name)} ${p.count}/${p.target}`}
          </span>
        );
      })}
    </span>
  );
}

export function HeroesScreen({ store, onBack, onCreate }: { store: HeroStore; onBack: () => void; onCreate: () => void }) {
  const { t } = useT();
  const { heroes, error, reload } = useHeroes(store);
  const [sure, setSure] = useState<string | null>(null);
  return (
    <div className="panel">
      <h2>{t('heroes')}</h2>
      <p className="muted">{t('heroModeNote')}</p>
      {error && <p className="error">{error}</p>}
      {heroes && !heroes.length && <p>{t('noHeroes')}</p>}
      <div className="hero-list">
        {heroes?.map((h) => (
          <HeroCard key={h.id} hero={h}>
            <button
              className={`ghost small ${sure === h.id ? 'danger' : ''}`}
              onClick={async () => {
                if (sure !== h.id) return setSure(h.id);
                await store.remove(h.id);
                setSure(null);
                reload();
              }}
            >
              {sure === h.id ? t('deleteSure') : t('deleteHero')}
            </button>
          </HeroCard>
        ))}
      </div>
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="primary" onClick={onCreate}>{t('createHero')}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Choosing a hero for a new game                                                              */
/* ------------------------------------------------------------------------------------------ */

export function HeroPickScreen({ store, multiplayer, size, onBack, onCreate, onStart }: {
  store: HeroStore;
  multiplayer: boolean;
  /** Game goals ask for more on a bigger map. */
  size: SizePreset;
  onBack: () => void;
  onCreate: () => void;
  /** Creates the game (locally or on the server). A thrown error is shown under the button. */
  onStart: (hero: Hero, missions: string[], seed: string) => void | Promise<void>;
}) {
  const { t, tx, locale } = useT();
  const { heroes, error: loadError } = useHeroes(store);
  const fitting = (heroes ?? []).filter((h) => heroFits(h, multiplayer));
  const [picked, setPicked] = useState<string | null>(null);
  const hero = fitting.find((h) => h.id === picked) ?? (fitting.length === 1 ? fitting[0] : undefined);
  const seed = useMemo(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, []);
  const offered = useMemo(() => drawMissionChoices(new Rng(seedFromString(`${seed}:missions`))), [seed]);
  const [missions, setMissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleMission = (id: string) => {
    if (missions.includes(id)) setMissions(missions.filter((m) => m !== id));
    else if (missions.length < MISSIONS_KEPT) setMissions([...missions, id]);
  };
  const start = async () => {
    if (!hero) return;
    setBusy(true);
    try {
      await onStart(hero, missions, seed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>{t('chooseHero')}</h2>
      {loadError && <p className="error">{loadError}</p>}
      {heroes && !fitting.length && (
        <div className="empty-heroes">
          <p>{t('noFittingHero')}</p>
          <button className="primary" onClick={onCreate}>{t('createHero')}</button>
        </div>
      )}
      <div className="hero-list">
        {fitting.map((h) => <HeroCard key={h.id} hero={h} active={hero?.id === h.id} onClick={() => setPicked(h.id)} />)}
      </div>
      {fitting.length > 0 && (
        <button className="ghost small add-hero" onClick={onCreate}>+ {t('createHero')}</button>
      )}

      {hero && (
        <>
          <h3>{t('missions')} <span className="muted">· {missions.length}/{MISSIONS_KEPT}</span></h3>
          <div className="choices">
            {offered.map((id) => {
              const m = MISSIONS.find((x) => x.id === id)!;
              return (
                <Choice key={id} active={missions.includes(id)} onClick={() => toggleMission(id)} title={`${tx(m.name)} · +${m.xp} ${t('xp')}`}>
                  {missionGoal(m, size, locale)}
                </Choice>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={onBack}>{t('back')}</button>
        <button className="primary" disabled={!hero || missions.length !== MISSIONS_KEPT || busy} onClick={start}>{t('start')}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Creating a hero                                                                             */
/* ------------------------------------------------------------------------------------------ */

const INTRO = {
  pl: [
    'Dawno temu Utopia była rajem. Różne rasy żyły tu w zgodzie i szczęściu, pracując ramię w ramię i dzieląc się swoimi zasobami, skarbami i wiedzą.',
    'Wszystko zmienił kataklizm nazwany Rozłamem. Ziemia zatrzęsła się w posadach, a ze środka świata wypłynęła ciemna materia, która rozdzieliła krainy zamieszkane przez różne rasy.',
    'Dziś nieliczni śmiałkowie próbują przebrnąć przez ciemną materię. Nigdy nie wiadomo, czy wrócą i gdzie wylądują, wkraczając w ciemność.',
  ],
  en: [
    'Long ago Utopia was a paradise. Many races lived there in harmony and joy, working side by side and sharing their resources, treasures and knowledge.',
    'Then came the cataclysm called the Rift. The earth shook to its roots, and from the heart of the world welled a dark matter that split apart the lands of the races.',
    'Now a daring few try to wade through the dark matter. No one knows whether they will come back, or where they will land once they step into the dark.',
  ],
};

/** The story of the world, written out on parchment as if by hand. */
function Parchment({ onDone }: { onDone: () => void }) {
  const { t, locale } = useT();
  const text = INTRO[locale];
  const full = text.join('\n\n');
  const [shown, setShown] = useState(0);
  const done = shown >= full.length;
  useEffect(() => {
    if (done) return;
    const ch = full[shown];
    const timer = setTimeout(() => setShown((n) => n + 1), ch === '\n' ? 260 : ch === '.' || ch === ',' ? 140 : 24);
    return () => clearTimeout(timer);
  }, [shown, done, full]);
  return (
    <div className="parchment-wrap">
      <motion.div className="parchment" initial={{ scaleY: 0.05, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
        <h2 className="parchment-title">Utopia</h2>
        <div className="parchment-text">
          {full.slice(0, shown).split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          {!done && <span className="quill" aria-hidden="true">✒</span>}
        </div>
      </motion.div>
      <div className="actions centred">
        {!done && <button className="ghost" onClick={() => setShown(full.length)}>{t('skip')}</button>}
        {done && <button className="primary" onClick={onDone}>{t('next')}</button>}
      </div>
    </div>
  );
}

const PART_KEY = { head: 'lookHead', torso: 'lookTorso', legs: 'lookLegs' } as const;

type Step = 'intro' | 'world' | 'look' | 'attrs' | 'dice' | 'name';
const STEPS: Step[] = ['intro', 'world', 'look', 'attrs', 'dice', 'name'];

export function CreateHeroScreen({ store, mode: presetMode, multiAllowed, onBack, onSaved }: {
  store: HeroStore;
  /** When creating a hero for a particular game, its mode is fixed. */
  mode?: 'solo' | 'multi';
  multiAllowed: boolean;
  onBack: () => void;
  onSaved: (hero: Hero) => void;
}) {
  const { t, tx } = useT();
  const [step, setStep] = useState<Step>('intro');
  const [focus, setFocus] = useState<RaceId | null>(null);
  const [race, setRace] = useState<RaceId>('keepers');
  const [profession, setProfession] = useState<ProfessionId>('wraith');
  const [look, setLook] = useState<HeroLook>(DEFAULT_LOOK);
  const [bonus, setBonus] = useState<Record<Attribute, number>>({ dex: 0, cha: 0, str: 0, wil: 0, int: 0, com: 0 });
  const [dice, setDice] = useState<DiceLook>(DEFAULT_DICE);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'solo' | 'multi'>(presetMode ?? 'solo');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const at = STEPS.indexOf(step);
  const back = () => (at === 0 ? onBack() : setStep(STEPS[at - 1]!));
  const next = () => setStep(STEPS[at + 1]!);
  const left = BONUS_POINTS - Object.values(bonus).reduce((a, b) => a + b, 0);
  const r = RACES[race];

  const chooseRace = (id: RaceId) => {
    setRace(id);
    setProfession(Object.values(PROFESSIONS).find((p) => p.race === id && p.mvp)!.id);
    setLook(DEFAULT_LOOK);
    setStep('look');
  };
  const adjust = (a: Attribute, delta: number) => {
    const n = bonus[a] + delta;
    if (n < 0 || (delta > 0 && left < delta)) return;
    setBonus({ ...bonus, [a]: n });
  };
  const save = async () => {
    setBusy(true);
    try {
      const input = { mode, name: name.trim(), race, profession, bonus, look, dice };
      validateHero(input);
      onSaved(await store.create(input));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'intro') {
    return (
      <div className="panel wide">
        <Parchment onDone={next} />
        <div className="actions"><button className="ghost" onClick={onBack}>{t('back')}</button></div>
      </div>
    );
  }

  const focused = focus ? RACES[focus] : null;
  return (
    <div className={`panel ${step === 'world' ? 'wide' : ''}`}>
      <ol className="steps">
        {STEPS.slice(1).map((s, i) => <li key={s} className={i + 1 < at ? 'done' : i + 1 === at ? 'now' : ''} />)}
      </ol>

      {step === 'world' && (
        <>
          <h2>{t('worldMap')}</h2>
          <p className="muted">{t('worldMapHint')}</p>
          <div className="world">
            <WorldMap focus={focus} onFocus={setFocus} onChoose={chooseRace} />
            <AnimatePresence mode="wait">
              {focused && (
                <motion.aside key={focused.id} className="race-info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="race-info-head">
                    <PixelHero race={focused.id} profession={Object.values(PROFESSIONS).find((p) => p.race === focused.id && p.mvp)!.id} size={64} />
                    <h3>{tx(focused.name)}</h3>
                  </div>
                  <p>{tx(focused.blurb)}</p>
                  <p className="muted">
                    {t('professions')}: {Object.values(PROFESSIONS).filter((p) => p.race === focused.id).map((p) => `${tx(p.name)}${p.mvp ? '' : ` (${t('soon')})`}`).join(', ')}
                  </p>
                  <ul className="passives">{focused.passives.map((p, i) => <li key={i}>{tx(p)}</li>)}</ul>
                  <button className="primary" onClick={() => chooseRace(focused.id)}>{t('chooseRace')}: {tx(focused.name)}</button>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {step === 'look' && (
        <>
          <h2>{tx(r.name)}</h2>
          <div className="look">
            <div className="look-preview">
              <PixelHero race={race} profession={profession} look={look} size={192} />
              <PixelHero race={race} profession={profession} look={look} size={64} walking />
            </div>
            <div className="look-options">
              <h3>{t('profession')}</h3>
              <div className="choices">
                {Object.values(PROFESSIONS).filter((p) => p.race === race).map((p) => (
                  <button key={p.id} className={`choice ${profession === p.id ? 'active' : ''}`} disabled={!p.mvp} aria-pressed={profession === p.id} onClick={() => setProfession(p.id)}>
                    <strong>{tx(p.name)}</strong>
                    <small>{p.mvp ? p.cards.map((c) => tx(c.name)).join(' · ') : t('soon')}</small>
                  </button>
                ))}
              </div>
              <h3>{t('looks')}</h3>
              {(['head', 'torso', 'legs'] as const).map((part) => (
                <div key={part} className="look-part">
                  <span>{t(PART_KEY[part])}</span>
                  <button aria-label={`← ${t(PART_KEY[part])}`} onClick={() => setLook({ ...look, [part]: (look[part] + LOOK_OPTIONS - 1) % LOOK_OPTIONS })}>‹</button>
                  <b>{tx(LOOK_NAMES[race][part][look[part]]!)}</b>
                  <button aria-label={`→ ${t(PART_KEY[part])}`} onClick={() => setLook({ ...look, [part]: (look[part] + 1) % LOOK_OPTIONS })}>›</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 'attrs' && (
        <>
          <h2>{t('attributes')}</h2>
          <p className="muted">{t('pointsLeft')}: {left}</p>
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
          <ul className="passives">
            {r.passives.map((p, i) => <li key={i}>{tx(p)}</li>)}
            <li>{t('speed')} {r.speed} · {t('stamina')} {r.stamina} · {t('vitality')} {r.vitality}</li>
          </ul>
        </>
      )}

      {step === 'dice' && (
        <>
          <h2>{t('dice')}</h2>
          <p className="muted">{t('diceNote')}</p>
          {(['d6', 'd10', 'd100'] as const).map((kind) => (
            <div key={kind} className="dice-pick">
              <motion.div key={dice[kind]} initial={{ rotate: -40, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                <DieFace kind={kind} value={kind === 'd6' ? 5 : kind === 'd10' ? 7 : 4} style={diceStyle(dice[kind])} size={72} />
              </motion.div>
              <div>
                <h3>{kind === 'd6' ? 'k6' : kind === 'd10' ? 'k10' : 'k100'}</h3>
                <div className="swatches">
                  {DICE_STYLES.map((s) => (
                    <button
                      key={s.id}
                      className={`swatch ${dice[kind] === s.id ? 'active' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
                      title={tx(s.name)}
                      aria-label={tx(s.name)}
                      aria-pressed={dice[kind] === s.id}
                      onClick={() => setDice({ ...dice, [kind]: s.id })}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {step === 'name' && (
        <>
          <div className="look-preview single"><PixelHero race={race} profession={profession} look={look} size={128} /></div>
          <h3>{t('name')}</h3>
          <input className="name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Ara" autoFocus />
          <h3>{t('heroMode')}</h3>
          <div className="choices">
            <Choice active={mode === 'solo'} onClick={() => !presetMode && setMode('solo')} title={t('heroSolo')} />
            <button className={`choice ${mode === 'multi' ? 'active' : ''}`} aria-pressed={mode === 'multi'} disabled={!multiAllowed || (!!presetMode && presetMode !== 'multi')} onClick={() => setMode('multi')}>
              <strong>{t('heroMulti')}</strong>
              {!multiAllowed && <small>{t('heroMultiNeedsServer')}</small>}
            </button>
          </div>
          <p className="muted">{t('heroModeNote')}</p>
        </>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="ghost" onClick={back}>{t('back')}</button>
        {step === 'world' ? null : step === 'name' ? (
          <button className="primary" disabled={!name.trim() || busy} onClick={save}>{t('saveHero')}</button>
        ) : (
          <button className="primary" onClick={next}>{t('next')}</button>
        )}
      </div>
    </div>
  );
}
