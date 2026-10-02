/**
 * Stylised SVG rank insignia (shoulder board / sleeve). Illustrative only —
 * replace with official artwork supplied by the Army when available.
 */
import type { Rank } from '@armyx/shared/content';

const Star = ({ cx, cy, r = 7 }: { cx: number; cy: number; r?: number }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r * 0.45 : r;
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
  }).join(' ');
  return <polygon points={pts} fill="#c9a43a" stroke="#7a5f14" strokeWidth="0.6" />;
};

export function Insignia({ rank }: { rank: Rank }) {
  const i = rank.insignia;
  if (i.chevrons !== undefined || rank.category === 'other') {
    // Sleeve chevrons for soldiers.
    return (
      <svg viewBox="0 0 80 100" className="h-24 w-20" role="img" aria-label={`${rank.name} insignia`}>
        <rect x="2" y="2" width="76" height="96" rx="8" fill="#3b4a2a" />
        {i.eagle && <Eagle x={40} y={22} s={0.7} />}
        {Array.from({ length: i.chevrons ?? 0 }, (_, k) => (
          <polyline key={k} points={`12,${46 + k * 14} 40,${62 + k * 14} 68,${46 + k * 14}`} fill="none" stroke="#c9a43a" strokeWidth="6" strokeLinejoin="round" />
        ))}
        {!i.chevrons && <text x="40" y="58" textAnchor="middle" fill="#d8cba8" fontSize="10" fontFamily="sans-serif">No insignia</text>}
      </svg>
    );
  }
  // Shoulder board for officers and warrant officers.
  const items: React.ReactNode[] = [];
  let y = 108;
  for (let k = 0; k < (i.pips ?? 0); k++) {
    items.push(<Star key={`p${k}`} cx={30} cy={y} />);
    y -= 20;
  }
  if (i.eagle) {
    items.push(<Eagle key="e" x={30} y={y - 2} s={0.8} />);
    y -= 26;
  }
  if (i.swords) items.push(<Swords key="s" y={y} />);
  if (i.crest) items.push(<circle key="c" cx={30} cy={y - 4} r={11} fill="#c9a43a" stroke="#7a5f14" />);
  return (
    <svg viewBox="0 0 60 140" className="h-28 w-12" role="img" aria-label={`${rank.name} insignia`}>
      <path d="M6 136 V22 L30 4 L54 22 V136 Z" fill="#3b4a2a" stroke="#1f2817" strokeWidth="2" />
      <circle cx="30" cy="22" r="4" fill="#c9a43a" />
      {i.wreath && <path d="M14 128 Q30 112 46 128" fill="none" stroke="#c9a43a" strokeWidth="3" />}
      {items}
    </svg>
  );
}

function Eagle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#c9a43a" stroke="#7a5f14" strokeWidth="0.8">
      <path d="M0 -10 L4 -4 L16 -8 L10 2 L4 2 L2 10 L-2 10 L-4 2 L-10 2 L-16 -8 L-4 -4 Z" />
    </g>
  );
}

function Swords({ y }: { y: number }) {
  return (
    <g stroke="#c9a43a" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1={y + 8} x2="42" y2={y - 14} />
      <line x1="42" y1={y + 8} x2="18" y2={y - 14} />
    </g>
  );
}
