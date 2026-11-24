import { motion } from 'motion/react';
import { ENEMIES } from '@hp/content';

export type HitKind = 'slash' | 'chop' | 'smash' | 'arrow' | 'claw' | 'bite' | 'poison' | 'magic' | 'trap';

/** What a weapon's name says about how it strikes. */
function byName(name: string): HitKind {
  const n = name.toLowerCase();
  if (/bow|crossbow|dart|blowpipe/.test(n)) return 'arrow';
  if (/axe/.test(n)) return 'chop';
  if (/fang/.test(n)) return 'bite';
  if (/claw|talon|paw/.test(n)) return 'claw';
  if (/venom|spine|sting/.test(n)) return 'poison';
  if (/lightning|shriek|magic|spell/.test(n)) return 'magic';
  if (/mace|hammer|club|fist|staff/.test(n)) return 'smash';
  return 'slash';
}

/** The kind of blow a hit shows: from the card played, the hero's weapon, or the foe's. */
export function hitKind(by: string, foeEnemy: string | undefined, hero: { weaponId: string; weaponName: string; ranged: boolean }, card?: string): HitKind {
  if (by === 'venom') return 'poison';
  if (by === 'trap') return 'trap';
  if (by === 'fire' || card?.startsWith('scroll')) return 'magic';
  if (by === 'hero') {
    if (card === 'warrior-heavy-swing') return 'smash';
    if (card === 'cavedelver-whirling-axe') return 'chop';
    if (card === 'diver-blowpipe') return 'arrow';
    if (hero.ranged) return 'arrow';
    return byName(`${hero.weaponId} ${hero.weaponName}`.replace('twoHanded', 'axe'));
  }
  const enemy = foeEnemy ? ENEMIES[foeEnemy] : undefined;
  return enemy ? byName(enemy.weapon.name.en) : 'slash';
}

const draw = { initial: { pathLength: 0, opacity: 1 }, animate: { pathLength: 1, opacity: [1, 1, 0] } };

/** A short burst drawn over whoever was hit, different for each kind of blow. */
export function HitFx({ kind }: { kind: HitKind }) {
  const t = { duration: 0.55, ease: 'easeOut' as const };
  return (
    <svg className={`hit-fx ${kind}`} viewBox="0 0 100 100" aria-hidden="true">
      {kind === 'slash' && (
        <motion.path d="M18 82 Q50 50 84 16" stroke="#fff" strokeWidth={7} strokeLinecap="round" fill="none" {...draw} transition={t} />
      )}
      {kind === 'chop' && (
        <>
          <motion.path d="M20 20 L80 80" stroke="#ffd0a0" strokeWidth={11} strokeLinecap="round" fill="none" {...draw} transition={t} />
          <motion.path d="M30 14 L86 70" stroke="#fff" strokeWidth={4} strokeLinecap="round" fill="none" {...draw} transition={{ ...t, delay: 0.06 }} />
        </>
      )}
      {kind === 'smash' && (
        <motion.polygon
          points="50,8 60,36 92,30 68,52 86,82 54,66 34,92 34,62 8,58 32,42 18,16 44,32"
          fill="#ffe27a" stroke="#fff" strokeWidth={3}
          initial={{ scale: 0.2, opacity: 1, rotate: -20 }} animate={{ scale: [0.2, 1.15, 1], opacity: [1, 1, 0], rotate: 0 }}
          style={{ transformOrigin: '50px 50px' }} transition={t}
        />
      )}
      {kind === 'arrow' && (
        <motion.g initial={{ x: -70, opacity: 1 }} animate={{ x: 0, opacity: [1, 1, 0] }} transition={{ duration: 0.5, ease: 'easeIn' }}>
          <path d="M10 50 L62 50" stroke="#e8d0a0" strokeWidth={4} />
          <path d="M62 42 L76 50 L62 58 Z" fill="#dfe6f0" />
          <path d="M10 44 L18 50 L10 56" stroke="#ff8a7a" strokeWidth={3} fill="none" />
        </motion.g>
      )}
      {(kind === 'claw' || kind === 'bite') && [0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={kind === 'claw' ? `M${28 + i * 16} 18 Q${22 + i * 16} 50 ${30 + i * 16} 84` : i < 2 ? `M${30 + i * 40} 22 L${40 + i * 20} 46` : 'M40 78 L50 56 L60 78'}
          stroke="#ff5a6e" strokeWidth={6} strokeLinecap="round" fill="none"
          {...draw} transition={{ ...t, delay: i * 0.06 }}
        />
      ))}
      {kind === 'poison' && [0, 1, 2, 3, 4].map((i) => (
        <motion.circle key={i} cx={30 + i * 10} cy={70} r={5 + (i % 2) * 3} fill="#7ae05a" initial={{ y: 0, opacity: 0.9 }} animate={{ y: -50 - i * 6, opacity: 0 }} transition={{ duration: 0.8, delay: i * 0.05 }} />
      ))}
      {kind === 'magic' && (
        <motion.path d="M56 6 L36 48 L54 48 L40 94 L70 40 L52 40 L66 6 Z" fill="#c9a7ff" stroke="#fff" strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.3, 1, 0] }} transition={{ duration: 0.6 }} />
      )}
      {kind === 'trap' && (
        <>
          <motion.path d="M10 30 L22 50 L34 30 L46 50 L58 30 L70 50 L82 30 L90 40" stroke="#c0c8d4" strokeWidth={5} fill="none" initial={{ y: -20 }} animate={{ y: [-20, 10, 10], opacity: [1, 1, 0] }} transition={t} />
          <motion.path d="M10 72 L22 52 L34 72 L46 52 L58 72 L70 52 L82 72 L90 62" stroke="#c0c8d4" strokeWidth={5} fill="none" initial={{ y: 20 }} animate={{ y: [20, -10, -10], opacity: [1, 1, 0] }} transition={t} />
        </>
      )}
    </svg>
  );
}
