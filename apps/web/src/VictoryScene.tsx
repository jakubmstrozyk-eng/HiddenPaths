import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { HeroLook, ProfessionId, RaceId } from '@hp/content';
import { HeroArt } from './HeroArt';

/**
 * The ending picture, played once (Jacob, 2026-11-27): in a Stone game the hero walks into the
 * castle's throne hall and hands the Stone to the king; in an exploration game the hero stands on a
 * hill as the whole world lights up. A few one-off transitions only, nothing that keeps running.
 */
export function VictoryScene({ mode, race, profession, look }: { mode: 'stone' | 'exploration'; race: RaceId; profession: ProfessionId; look?: HeroLook }) {
  const [walking, setWalking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWalking(false), 1500);
    return () => clearTimeout(t);
  }, []);
  return mode === 'stone' ? <ThroneHall walking={walking} race={race} profession={profession} look={look} /> : <WorldDawn race={race} profession={profession} look={look} />;
}

type Hero = { race: RaceId; profession: ProfessionId; look?: HeroLook };

function ThroneHall({ walking, race, profession, look }: Hero & { walking: boolean }) {
  return (
    <div className="victory-scene">
      <svg viewBox="0 0 400 220" aria-hidden="true">
        <rect width={400} height={220} fill="#1c1428" />
        {/* Pillars and banners. */}
        {[30, 110, 290, 370].map((x) => <rect key={x} x={x - 10} y={0} width={20} height={170} fill="#2e2440" stroke="#0e0a16" strokeWidth={2} />)}
        {[70, 330].map((x) => <path key={x} d={`M${x - 14} 14 L${x + 14} 14 L${x + 14} 70 L${x} 60 L${x - 14} 70 Z`} fill="#7a1e2a" stroke="#0e0a16" strokeWidth={2} />)}
        {[70, 330].map((x) => <circle key={`c${x}`} cx={x} cy={36} r={6} fill="#d8b040" />)}
        {/* Floor and the red carpet to the throne. */}
        <rect y={170} width={400} height={50} fill="#3a3046" />
        <polygon points="150,220 250,220 235,170 165,170" fill="#8a2030" />
        {/* Steps and throne. */}
        <rect x={160} y={156} width={80} height={14} fill="#4a405a" stroke="#0e0a16" strokeWidth={2} />
        <rect x={180} y={70} width={40} height={86} fill="#6a4a20" stroke="#0e0a16" strokeWidth={2} />
        <polygon points="176,70 200,46 224,70" fill="#d8b040" stroke="#0e0a16" strokeWidth={2} />
        {/* The king: robe, face, beard and crown. */}
        <path d="M184 156 L188 108 Q200 98 212 108 L216 156 Z" fill="#5a2a7a" stroke="#0e0a16" strokeWidth={2} />
        <rect x={186} y={118} width={28} height={6} fill="#f0ece0" />
        <circle cx={200} cy={94} r={11} fill="#e8c09a" stroke="#0e0a16" strokeWidth={1.5} />
        <path d="M190 98 Q200 116 210 98 Z" fill="#e8e8e8" stroke="#0e0a16" strokeWidth={1} />
        <path d="M189 86 L189 76 L194 81 L200 73 L206 81 L211 76 L211 86 Z" fill="#f0c840" stroke="#0e0a16" strokeWidth={1.5} />
        {/* The Stone, which appears in the king's hands once the hero has arrived. */}
        <motion.g initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.6 }}>
          <circle cx={200} cy={132} r={16} fill="#c9b8ff" opacity={0.3} />
          <polygon points="200,122 209,132 200,142 191,132" fill="#c9b8ff" stroke="#0e0a16" strokeWidth={1.5} />
        </motion.g>
      </svg>
      <motion.div className="victory-hero" initial={{ left: '6%' }} animate={{ left: '30%' }} transition={{ duration: 1.5, ease: 'easeOut' }}>
        <HeroArt race={race} profession={profession} look={look} size={72} walking={walking} />
      </motion.div>
    </div>
  );
}

function WorldDawn({ race, profession, look }: Hero) {
  return (
    <div className="victory-scene">
      <svg viewBox="0 0 400 220" aria-hidden="true">
        <rect width={400} height={220} fill="#1a2440" />
        <motion.rect width={400} height={220} fill="#f0a060" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ duration: 1.8 }} />
        <motion.circle cx={300} r={30} fill="#ffe8a0" initial={{ cy: 190 }} animate={{ cy: 80 }} transition={{ duration: 1.8, ease: 'easeOut' }} />
        <path d="M0 170 Q100 120 200 160 T400 150 L400 220 L0 220 Z" fill="#3a5a3a" />
        <path d="M0 200 Q120 160 240 190 T400 185 L400 220 L0 220 Z" fill="#2a4a2a" />
        <path d="M60 200 Q110 150 160 200 Z" fill="#4a6a3a" />
      </svg>
      <div className="victory-hero" style={{ left: '22%' }}>
        <HeroArt race={race} profession={profession} look={look} size={72} />
      </div>
    </div>
  );
}
