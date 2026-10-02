'use client';
/**
 * Minimal, dependency-free SVG/HTML charts for the admin dashboard.
 * Single-series → one olive hue (no legend needed; the title names the series),
 * thin marks with 4px rounded data-ends, recessive grid, hover tooltips with
 * hit areas larger than the marks, and a table view for accessibility.
 */
import { useState } from 'react';

const BAR = '#4b5d35';
const BAR_HOVER = '#2f3b22';
const fmt = (n: number) => n.toLocaleString('en-NG');

export function StatTile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-olive-900 tabular-nums">{typeof value === 'number' ? fmt(value) : value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function TableToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} className="text-xs font-semibold text-olive-700 underline">{show ? 'Show chart' : 'Show table'}</button>;
}

/** Vertical columns for change over time (daily submissions). */
export function ColumnChart({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 640, H = 220, P = { l: 44, r: 8, t: 12, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const step = (W - P.l - P.r) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(28, step - 2));
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / top);
  const ticks = [0, top / 2, top];
  return (
    <figure className="card p-5">
      <figcaption className="flex items-center justify-between"><span className="font-semibold text-olive-900">{title}</span><TableToggle show={table} onToggle={() => setTable(!table)} /></figcaption>
      {table ? (
        <table className="mt-4 w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-1">Date</th><th className="py-1 text-right">Applications</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label} className="border-t border-olive-100"><td className="py-1">{d.label}</td><td className="py-1 text-right tabular-nums">{fmt(d.value)}</td></tr>)}</tbody></table>
      ) : (
        <div className="relative mt-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e7ebdc" />
                <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4f5a45">{fmt(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = P.l + i * step + (step - bw) / 2;
              const h = Math.max(0, y(0) - y(d.value));
              return (
                <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={P.l + i * step} y={P.t} width={step} height={H - P.t - P.b} fill="transparent" />
                  {/* rounded top, square baseline */}
                  <path d={`M${x},${y(0)} V${y(0) - h + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)} H${x + bw - Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)} V${y(0)} Z`} fill={hover === i ? BAR_HOVER : BAR} />
                  {(i === 0 || i === data.length - 1 || data.length <= 10) && <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#4f5a45">{d.label.slice(5)}</text>}
                </g>
              );
            })}
            <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="#b39f74" />
          </svg>
          {hover !== null && data[hover] && (
            <div className="pointer-events-none absolute top-0 rounded-md bg-olive-950 px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((P.l + hover * step + step / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}>
              <p className="font-semibold">{data[hover].label}</p><p className="tabular-nums">{fmt(data[hover].value)} applications</p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for ranked categories (by state / status). */
export function BarList({ title, data, total }: { title: string; data: { label: string; value: number }[]; total?: number }) {
  const [table, setTable] = useState(false);
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const shown = all ? sorted : sorted.slice(0, 10);
  return (
    <figure className="card p-5">
      <figcaption className="flex items-center justify-between"><span className="font-semibold text-olive-900">{title}</span><TableToggle show={table} onToggle={() => setTable(!table)} /></figcaption>
      {table ? (
        <table className="mt-4 w-full text-sm"><tbody>{sorted.map((d) => <tr key={d.label} className="border-t border-olive-100"><td className="py-1">{d.label}</td><td className="py-1 text-right tabular-nums">{fmt(d.value)}</td></tr>)}</tbody></table>
      ) : (
        <ul className="mt-4 space-y-2">
          {shown.map((d) => (
            <li key={d.label} className="group grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${fmt(d.value)}${total ? ` (${((d.value / total) * 100).toFixed(1)}%)` : ''}`}>
              <span className="truncate text-ink">{d.label}</span>
              <span className="h-3 rounded-r bg-olive-50"><span className="block h-3 rounded-r-[4px] bg-olive-600 group-hover:bg-olive-800" style={{ width: `${(d.value / max) * 100}%` }} /></span>
              <span className="w-14 text-right text-ink tabular-nums">{fmt(d.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {!table && sorted.length > 10 && <button type="button" onClick={() => setAll(!all)} className="mt-3 text-xs font-semibold text-olive-700 underline">{all ? 'Show top 10' : `Show all ${sorted.length}`}</button>}
    </figure>
  );
}
