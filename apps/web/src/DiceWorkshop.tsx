import { motion } from 'motion/react';
import { DICE_BOXES, DICE_ENGRAVINGS, DICE_FINISHES, DICE_STYLES, type DiceLook } from '@hp/content';
import { RealDie } from './RealDie';
import { useT } from './i18n';

/**
 * The hero's dice and dice box: colours for each kind of die, a finish (polished, matte, pearl,
 * metal), what is cut into them, and the box they are thrown into, all shown in a small tray.
 */
export function DiceWorkshop({ dice, onChange }: { dice: DiceLook; onChange: (d: DiceLook) => void }) {
  const { t, tx } = useT();
  const set = (patch: Partial<DiceLook>) => onChange({ ...dice, ...patch });
  const box = dice.box ?? 'oak';
  return (
    <div className="dice-workshop">
      <h2>{t('dice')}</h2>
      <p className="muted">{tx({ pl: 'Wybierz barwy, wykończenie i zdobienia kości oraz skrzynkę, do której nimi rzucasz.', en: 'Pick the colours, finish and engraving of your dice, and the box you throw them into.' })}</p>

      <div className={`dice-box workshop-box box-${box}`} aria-hidden="true">
        <div className="dice-box-felt">
          <motion.span key={`${dice.d6}${dice.finish}${dice.engrave}`} className="ws-die" style={{ left: '14%', top: '30%' }} initial={{ rotate: -50, scale: 0.7 }} animate={{ rotate: -8, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 14 }}>
            <RealDie sides={6} dice={dice} kind="d6" size={64} face="5" />
          </motion.span>
          <motion.span key={`${dice.d100}${dice.finish}${dice.engrave}t`} className="ws-die" style={{ left: '42%', top: '18%' }} initial={{ rotate: 50, scale: 0.7 }} animate={{ rotate: 6, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 14 }}>
            <RealDie sides={10} tens dice={dice} kind="d100" size={64} face="40" />
          </motion.span>
          <motion.span key={`${dice.d10}${dice.finish}${dice.engrave}u`} className="ws-die" style={{ left: '66%', top: '38%' }} initial={{ rotate: -40, scale: 0.7 }} animate={{ rotate: -4, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 14 }}>
            <RealDie sides={10} dice={dice} kind="d10" size={64} face="7" />
          </motion.span>
        </div>
      </div>

      <h3>{tx({ pl: 'Barwy', en: 'Colours' })}</h3>
      {(['d6', 'd10', 'd100'] as const).map((kind) => (
        <div key={kind} className="ws-row">
          <span>{kind === 'd6' ? 'k6' : kind === 'd10' ? tx({ pl: 'k10 (jedności)', en: 'd10 (units)' }) : tx({ pl: 'k100 (dziesiątki)', en: 'd100 (tens)' })}</span>
          <div className="swatches">
            {DICE_STYLES.map((s) => (
              <button
                key={s.id}
                className={`swatch ${dice[kind] === s.id ? 'active' : ''}`}
                style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
                title={tx(s.name)}
                aria-label={tx(s.name)}
                aria-pressed={dice[kind] === s.id}
                onClick={() => set({ [kind]: s.id })}
              />
            ))}
          </div>
        </div>
      ))}

      <h3>{tx({ pl: 'Wykończenie', en: 'Finish' })}</h3>
      <div className="ws-options">
        {DICE_FINISHES.map((f) => (
          <button key={f.id} className={`ws-option ${(dice.finish ?? 'gloss') === f.id ? 'active' : ''}`} aria-pressed={(dice.finish ?? 'gloss') === f.id} onClick={() => set({ finish: f.id })}>
            <RealDie sides={10} dice={{ ...dice, finish: f.id }} kind="d100" size={34} face="7" />
            <span>{tx(f.name)}</span>
          </button>
        ))}
      </div>

      <h3>{tx({ pl: 'Zdobienia', en: 'Engraving' })}</h3>
      <div className="ws-options">
        {DICE_ENGRAVINGS.map((f) => (
          <button key={f.id} className={`ws-option ${(dice.engrave ?? 'plain') === f.id ? 'active' : ''}`} aria-pressed={(dice.engrave ?? 'plain') === f.id} onClick={() => set({ engrave: f.id })}>
            <RealDie sides={10} dice={{ ...dice, engrave: f.id }} kind="d100" size={34} face="7" />
            <span>{tx(f.name)}</span>
          </button>
        ))}
      </div>

      <h3>{tx({ pl: 'Skrzynka', en: 'Dice box' })}</h3>
      <div className="ws-options boxes">
        {DICE_BOXES.map((b) => (
          <button key={b.id} className={`ws-option ${box === b.id ? 'active' : ''}`} aria-pressed={box === b.id} onClick={() => set({ box: b.id })}>
            <span className={`dice-box mini-box box-${b.id}`} aria-hidden="true"><span className="dice-box-felt" /></span>
            <span>{tx(b.name)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
