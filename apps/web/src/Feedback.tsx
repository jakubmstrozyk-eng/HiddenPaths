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

/** A short tone, for the mini-games: a tick, a chime, a clang. */
function tone(c: AudioContext, freq: number, ms: number, volume: number, type: OscillatorType = 'sine', at = 0) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(volume, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + ms / 1000 + 0.05);
}

/** One note of a mini-game tune: a ghostly sine, a witch's reed or a plucked lute. */
export function puzzleNote(n: number, theme: 'ghost' | 'witch' | 'lute', ms = 380) {
  const c = ctx();
  if (!c) return;
  const freq = [392, 494, 587, 698, 784][n % 5]!;
  try {
    if (theme === 'ghost') { tone(c, freq, ms, 0.16, 'sine'); tone(c, freq * 1.01, ms, 0.08, 'sine'); }
    if (theme === 'witch') tone(c, freq * 0.75, ms, 0.12, 'sawtooth');
    if (theme === 'lute') { tone(c, freq, Math.min(ms, 300), 0.2, 'triangle'); tone(c, freq * 2, 120, 0.06, 'square'); }
  } catch { /* no sound */ }
}

/** Puzzle feedback: a rising chime for a right move, a low buzz for a wrong one, a tick, an anvil's clang. */
export function puzzleSound(kind: 'right' | 'wrong' | 'tick' | 'clang' | 'win' | 'boom') {
  const c = ctx();
  if (!c) return;
  try {
    if (kind === 'tick') tone(c, 1800, 40, 0.08, 'square');
    if (kind === 'right') { tone(c, 660, 140, 0.2); tone(c, 990, 180, 0.18, 'sine', 0.08); }
    if (kind === 'wrong') { tone(c, 160, 260, 0.25, 'sawtooth'); buzz(60); }
    if (kind === 'clang') { [1, 2.76, 5.4].forEach((m, i) => tone(c, 420 * m, 500 - i * 120, 0.22 / (i + 1), 'sine')); noise(c, 60, 'highpass', 3000, 2000, 0.3); buzz(30); }
    if (kind === 'win') [523, 659, 784, 1046].forEach((f, i) => tone(c, f, 260, 0.18, 'triangle', i * 0.09));
    if (kind === 'boom') { noise(c, 500, 'lowpass', 1200, 80, 0.8); buzz([80, 40, 120]); }
  } catch { /* no sound */ }
}
