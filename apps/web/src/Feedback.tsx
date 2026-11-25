import { motion } from 'motion/react';
import { buzz } from './Throw';
import { useT } from './i18n';
import { Icon } from './Icons';

let audio: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

/** A burst of noise through a filter, used for whooshes and impacts. */
function noise(c: AudioContext, ms: number, filter: BiquadFilterType, from: number, to: number, volume: number, at = 0) {
  const len = Math.floor((c.sampleRate * ms) / 1000);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = 1.4;
  const t0 = c.currentTime + at;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + ms / 1000);
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

/** A card slides off the deck: a soft whoosh, then a light tap as it lands. */
export function cardSwish() {
  const c = ctx();
  if (!c) return;
  try {
    noise(c, 380, 'bandpass', 600, 3800, 0.35);
    noise(c, 50, 'highpass', 2500, 2400, 0.18, 0.62);
  } catch { /* no sound */ }
}

/** The hero takes a blow: a low thump with a crack on top, and the phone shudders. */
export function hurtSound(heavy = false) {
  buzz(heavy ? [120, 60, 200] : [90, 40, 70]);
  const c = ctx();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 150 : 180, t0);
    osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(heavy ? 0.9 : 0.7, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.5);
    noise(c, 120, 'lowpass', 2200, 300, 0.5);
  } catch { /* no sound */ }
}

/** A bite of bread: a few quick crunches. */
export function munch() {
  const c = ctx();
  if (!c) return;
  try {
    for (let i = 0; i < 3; i++) noise(c, 60, 'bandpass', 1400 + i * 300, 900, 0.25, i * 0.13);
  } catch { /* no sound */ }
  buzz(20);
}

/**
 * The hero lost Vitality: the screen flashes red from the edges, a crack strikes across the middle
 * and the loss floats up, so a fall or a wound is never missed.
 */
export function HurtFlash({ amount, cause, fatal = false }: { amount: number; cause?: string; fatal?: boolean }) {
  const { tx } = useT();
  return (
    <div className="hurt-layer" aria-live="assertive">
      <motion.div
        className="hurt-vignette"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.55, 0] }}
        transition={{ duration: fatal ? 1.6 : 1.1, times: [0, 0.12, 0.4, 1] }}
      />
      <svg className="hurt-crack" viewBox="0 0 200 200" aria-hidden="true">
        <motion.path
          d="M40 30 L92 88 L74 98 L150 172 M92 88 L120 70 M74 98 L48 120"
          stroke="#fff" strokeWidth={6} strokeLinecap="square" fill="none"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.path
          d="M40 30 L92 88 L74 98 L150 172"
          stroke="#ff3b4f" strokeWidth={14} strokeLinecap="square" fill="none" style={{ mixBlendMode: 'screen' }}
          initial={{ pathLength: 0, opacity: 0.8 }}
          animate={{ pathLength: 1, opacity: [0.8, 0.8, 0] }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />
      </svg>
      <motion.div
        className="hurt-amount"
        initial={{ opacity: 0, scale: 2.2, y: 0 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [2.2, 1, 1, 0.9], y: [0, 0, -20, -70] }}
        transition={{ duration: 1.9, times: [0, 0.12, 0.65, 1] }}
      >
        <b><Icon name="vitality" size={30} /> −{amount}</b>
        <small>{fatal ? tx({ pl: 'Śmiertelny cios!', en: 'A fatal blow!' }) : cause ?? tx({ pl: 'Tracisz Żywotność', en: 'You lose Vitality' })}</small>
      </motion.div>
    </div>
  );
}
