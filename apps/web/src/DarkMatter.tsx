import { useEffect, useRef } from 'react';

/**
 * The living void behind the menus: slow drifting specks and soft ripples on black.
 * A placeholder for the GPU shader planned for the map; it already respects reduced motion.
 */
export function DarkMatter() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;
    const specks = Array.from({ length: 90 }, (_, i) => ({
      x: (i * 97.13) % 1,
      y: (i * 53.71) % 1,
      r: 0.4 + ((i * 7) % 10) / 8,
      v: 0.00004 + ((i * 13) % 10) / 120000,
      a: 0.15 + ((i * 11) % 10) / 25,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      // Ripples: a few large, very faint rings breathing from the centre.
      for (let i = 0; i < 3; i++) {
        const phase = (frame / 900 + i / 3) % 1;
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * (0.3 + phase * 0.7));
        g.addColorStop(0, 'rgba(70, 60, 120, 0)');
        g.addColorStop(0.92, `rgba(90, 80, 160, ${0.05 * (1 - phase)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (const s of specks) {
        const y = (s.y - frame * s.v + 1) % 1;
        const x = s.x + Math.sin(frame / 400 + s.y * 10) * 0.01;
        ctx.fillStyle = `rgba(190, 180, 255, ${s.a * (0.6 + 0.4 * Math.sin(frame / 60 + s.x * 20))})`;
        ctx.fillRect(x * w, y * h, s.r, s.r);
      }
      frame++;
      if (!still) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="dark-matter" aria-hidden="true" />;
}
