/**
 * Ambient embers rising behind every screen (dark themes, effects on — hidden by CSS otherwise). Pure CSS animation:
 * positions, sizes and speeds are drawn once when the app starts. Display only.
 */
import { useMemo, type CSSProperties } from 'react';

const COUNT = 46;

export function Embers() {
  const embers = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const big = Math.random() < 0.18;
        return {
          i,
          blur: Math.random() < 0.3,
          style: {
            left: `${Math.random() * 100}%`,
            '--s': `${big ? 4 + Math.random() * 3 : 2 + Math.random() * 2.5}px`,
            '--d': `${12 + Math.random() * 16}s`,
            '--delay': `${-Math.random() * 28}s`,
            '--dx': `${(Math.random() - 0.5) * 160}px`,
            '--o': `${big ? 0.9 : 0.5 + Math.random() * 0.4}`,
          } as CSSProperties,
        };
      }),
    [],
  );
  return (
    <div className="embers" aria-hidden="true">
      {embers.map((e) => (
        <i key={e.i} className={`ember ${e.blur ? 'blur' : ''}`} style={e.style} />
      ))}
    </div>
  );
}
