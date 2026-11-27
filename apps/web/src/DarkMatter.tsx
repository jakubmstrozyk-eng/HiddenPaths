import { useEffect, useRef } from 'react';

/**
 * The living void behind the menus. Black dark matter covers everything; faint white light
 * seeps through its cracks. The pointer dissolves the matter as it passes and the matter
 * creeps back behind it; a click (see `pulseDarkMatter`) blows a ring of it away.
 * Black and white only. Respects reduced motion (one still frame).
 */

type Pulse = { x: number; y: number; t: number; strength: number };
const pulses: Pulse[] = [];
let clock = 0;

/** Blows a ring of dark matter away from a point on screen (CSS pixels). */
export function pulseDarkMatter(x: number, y: number, strength = 1) {
  pulses.push({ x, y, t: clock, strength });
  if (pulses.length > 8) pulses.shift();
}

// Value noise on a fixed hash grid: cheap enough to evaluate per cell per frame.
const P = new Uint8Array(512);
{
  const perm = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = tmp;
  }
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255]!;
}
const fade = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const X = xi & 255;
  const Y = yi & 255;
  const px = P[X]! + Y;
  const px1 = P[X + 1]! + Y;
  const a = P[px]! / 255;
  const b = P[px1]! / 255;
  const c = P[px + 1]! / 255;
  const d = P[px1 + 1]! / 255;
  const u = fade(xf);
  const v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  return noise(x, y) * 0.55 + noise(x * 2.03 + 17, y * 2.03 + 9) * 0.3 + noise(x * 4.1 + 41, y * 4.1 + 23) * 0.15;
}

export function DarkMatter({ calm = false, dim = false }: { calm?: boolean; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const calmRef = useRef(calm);
  calmRef.current = calm;
  /** Behind a screen full of text the cracks glow less. */
  const dimRef = useRef(dim);
  dimRef.current = dim;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CELL = 8;
    const small = document.createElement('canvas');
    const sctx = small.getContext('2d')!;
    let cols = 0;
    let rows = 0;
    let img: ImageData;
    /** How much light each cell lets through because the pointer or a pulse cleared it; decays as matter returns. */
    let cleared = new Float32Array(0);
    let raf = 0;
    let stopped = false;
    const start = performance.now();
    let glow = dimRef.current ? 0.4 : 1;
    const pointer = { x: -9999, y: -9999, sx: -9999, sy: -9999, active: false };

    const motes = Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 97.13) % 1) * window.innerWidth,
      y: ((i * 53.71) % 1) * window.innerHeight,
      vx: 0,
      vy: 0,
      r: 0.6 + ((i * 7) % 10) / 9,
      a: 0.25 + ((i * 11) % 10) / 20,
      drift: 0.08 + ((i * 13) % 10) / 60,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(canvas.clientWidth / CELL) + 1;
      rows = Math.ceil(canvas.clientHeight / CELL) + 1;
      small.width = cols;
      small.height = rows;
      img = sctx.createImageData(cols, rows);
      cleared = new Float32Array(cols * rows);
    };
    resize();

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (!pointer.active) {
        pointer.sx = e.clientX;
        pointer.sy = e.clientY;
      }
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    const draw = () => {
      if (stopped) return;
      const now = performance.now();
      const t = (now - start) / 1000;
      clock = t;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      // The matter parts from the cracks during the first seconds.
      const reveal = still ? 1 : Math.min(1, t / 2.4);
      const revealEase = 1 - (1 - reveal) ** 3;
      glow += ((dimRef.current ? 0.4 : 1) - glow) * 0.05;

      // Pointer trail: the smoothed pointer stamps a soft hole into `cleared`.
      pointer.sx += (pointer.x - pointer.sx) * 0.18;
      pointer.sy += (pointer.y - pointer.sy) * 0.18;
      const pr = Math.min(170, Math.max(90, w * 0.12));
      if (pointer.active) {
        const cx = pointer.sx / CELL;
        const cy = pointer.sy / CELL;
        const rc = pr / CELL;
        for (let y = Math.max(0, Math.floor(cy - rc)); y < Math.min(rows, Math.ceil(cy + rc)); y++) {
          for (let x = Math.max(0, Math.floor(cx - rc)); x < Math.min(cols, Math.ceil(cx + rc)); x++) {
            const d = Math.hypot(x - cx, y - cy) / rc;
            if (d < 1) {
              const i = y * cols + x;
              cleared[i] = Math.min(1, cleared[i]! + (1 - d) * (1 - d) * 0.09);
            }
          }
        }
      }
      // Pulses: an expanding ring that blows the matter open and leaves it cleared.
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k]!;
        const age = t - p.t;
        if (age > 1.1) {
          pulses.splice(k, 1);
          continue;
        }
        const radius = (40 + age * 520 * p.strength) / CELL;
        const band = 5 + age * 6;
        const cx = p.x / CELL;
        const cy = p.y / CELL;
        const power = (1 - age / 1.1) * 0.22 * p.strength;
        const r2 = radius + band;
        for (let y = Math.max(0, Math.floor(cy - r2)); y < Math.min(rows, Math.ceil(cy + r2)); y++) {
          for (let x = Math.max(0, Math.floor(cx - r2)); x < Math.min(cols, Math.ceil(cx + r2)); x++) {
            const d = Math.abs(Math.hypot(x - cx, y - cy) - radius);
            if (d < band) {
              const i = y * cols + x;
              cleared[i] = Math.min(1, cleared[i]! + (1 - d / band) * power);
            }
          }
        }
      }

      const data = img.data;
      const tt = t * 0.045;
      const scale = 0.0052 * CELL;
      const midX = cols / 2;
      const midY = rows * 0.45;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const nx = x * scale;
          const ny = y * scale;
          // Domain warp makes the matter flow like smoke rather than slide.
          const wx = noise(nx * 0.7 + tt, ny * 0.7 - tt * 0.6) * 1.6;
          const n = fbm(nx + wx + tt * 0.5, ny - wx * 0.7 - tt * 0.8);
          // Cracks: thin lines where the matter field crosses its middle value.
          const crack = Math.max(0, 1 - Math.abs(n - 0.5) * 11);
          // Light pools: rarer, softer places where the matter is thin.
          const pool = Math.max(0, (n - 0.66) * 3.2);
          const open = cleared[i]!;
          // The matter returns slowly: the world closes over the path again.
          cleared[i] = open * 0.975;
          const crackLit = crack * crack * (0.2 * glow + open * 0.55) * revealEase;
          const opened = open * (0.18 + n * 0.32 + crack * 0.4);
          // Keep the middle (title and tiles) darker so white text stays readable.
          const dx = (x - midX) / midX;
          const dy = (y - midY) / midY;
          const centre = Math.min(1, 0.45 + 0.55 * Math.sqrt(dx * dx * 0.9 + dy * dy * 0.6));
          let L = (crackLit + pool * 0.07 * glow * revealEase) * centre + opened * (0.5 + glow * 0.5);
          if (L > 1) L = 1;
          const v = (L * 255) | 0;
          const o = i * 4;
          data[o] = v;
          data[o + 1] = v;
          data[o + 2] = v;
          data[o + 3] = 255;
        }
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(small, 0, 0, cols * CELL, rows * CELL);

      // Motes of light drift up; the pointer pushes them aside, pulses scatter them.
      for (const m of motes) {
        m.vy -= m.drift * 0.004;
        if (pointer.active) {
          const dx = m.x - pointer.sx;
          const dy = m.y - pointer.sy;
          const d2 = dx * dx + dy * dy;
          if (d2 < pr * pr && d2 > 1) {
            const f = (1 - Math.sqrt(d2) / pr) * 0.35;
            m.vx += (dx / Math.sqrt(d2)) * f;
            m.vy += (dy / Math.sqrt(d2)) * f;
          }
        }
        for (const p of pulses) {
          const age = t - p.t;
          if (age < 0.15) {
            const dx = m.x - p.x;
            const dy = m.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 260) {
              m.vx += (dx / d) * (1 - d / 260) * 2.2 * p.strength;
              m.vy += (dy / d) * (1 - d / 260) * 2.2 * p.strength;
            }
          }
        }
        m.vx *= 0.94;
        m.vy *= 0.94;
        m.x += m.vx + Math.sin(t * 0.6 + m.r * 9) * 0.12;
        m.y += m.vy - m.drift;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
        if (m.x < -4) m.x = w + 4;
        if (m.x > w + 4) m.x = -4;
        const tw = 0.55 + 0.45 * Math.sin(t * 1.7 + m.x * 0.05);
        ctx.fillStyle = `rgba(255,255,255,${m.a * tw * revealEase})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!still) {
        // Behind a game screen the void only needs to breathe, not to keep full pace.
        if (calmRef.current) raf = window.setTimeout(() => (raf = requestAnimationFrame(draw)), 60) as unknown as number;
        else raf = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} className="dark-matter" aria-hidden="true" />;
}
