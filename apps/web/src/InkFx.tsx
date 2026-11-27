import { useEffect, useState } from 'react';
import { pulseDarkMatter } from './DarkMatter';

type Splash = { id: number; x: number; y: number; big: boolean; drops: { a: number; d: number; r: number }[] };

let nextId = 1;

/** Buttons that answer the pointer with dark matter: hover spreads ink from the pointer, a press splashes. */
const INKY = 'button, .tile, a';

/**
 * Global interface dynamics around the dark matter motif:
 * - every button remembers where the pointer is (--mx/--my) so its hover ink spreads from there;
 * - every press throws a small splash of matter (drawn with difference blending, so it is dark on white and white on dark)
 *   and blows a ring open in the void behind the menus.
 */
export function InkFx() {
  const [splashes, setSplashes] = useState<Splash[]>([]);

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const track = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(INKY) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const press = (e: PointerEvent) => {
      track(e);
      const el = (e.target as Element | null)?.closest?.(INKY) as HTMLElement | null;
      // A press on the bare void still stirs the matter.
      if (!el) return void pulseDarkMatter(e.clientX, e.clientY, 0.8);
      if ((el as HTMLButtonElement).disabled) return;
      const big = el.classList.contains('tile');
      pulseDarkMatter(e.clientX, e.clientY, big ? 1.3 : 0.6);
      if (still) return;
      const id = nextId++;
      const drops = Array.from({ length: big ? 9 : 6 }, () => ({
        a: Math.random() * Math.PI * 2,
        d: (big ? 34 : 20) + Math.random() * (big ? 46 : 24),
        r: 2 + Math.random() * (big ? 5 : 3),
      }));
      setSplashes((s) => [...s.slice(-6), { id, x: e.clientX, y: e.clientY, big, drops }]);
      window.setTimeout(() => setSplashes((s) => s.filter((p) => p.id !== id)), 700);
    };
    document.addEventListener('pointerover', track, { passive: true });
    document.addEventListener('pointermove', track, { passive: true });
    document.addEventListener('pointerdown', press, { passive: true });
    return () => {
      document.removeEventListener('pointerover', track);
      document.removeEventListener('pointermove', track);
      document.removeEventListener('pointerdown', press);
    };
  }, []);

  return (
    <>
      {/* Shared filters: a wavering, eaten edge for anything made of dark matter. */}
      <svg className="ink-defs" aria-hidden="true" width="0" height="0">
        <defs>
          <filter id="ink-edge" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n">
              <animate attributeName="baseFrequency" dur="9s" values="0.035;0.05;0.035" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="ink-layer" aria-hidden="true">
        {splashes.map((s) => (
          <svg key={s.id} className={`ink-splash${s.big ? ' big' : ''}`} style={{ left: s.x, top: s.y }} viewBox="-100 -100 200 200" width="200" height="200">
            <g filter="url(#ink-edge)">
              <circle className="ink-ring" r={s.big ? 46 : 26} />
              {s.drops.map((d, i) => (
                <circle
                  key={i}
                  className="ink-drop"
                  r={d.r}
                  style={{ '--dx': `${Math.cos(d.a) * d.d}px`, '--dy': `${Math.sin(d.a) * d.d}px` } as React.CSSProperties}
                />
              ))}
            </g>
          </svg>
        ))}
      </div>
    </>
  );
}
