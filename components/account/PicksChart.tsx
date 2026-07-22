'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface PicksChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

interface PicksChartProps {
  title: string;
  data: PicksChartPoint[];
  color: string;
  unit?: string; // e.g. '%'
}

const H = 112;
const PAD_X = 10;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Small single-series trend line for a team's saved-picks history: one save =
 * one point, evenly spaced. First/last points are direct-labeled; every point
 * has a hover tooltip. Single series, so no legend — the title names it.
 */
export default function PicksChart({ title, data, color, unit = '' }: PicksChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();
  // Draw 1:1 with the container's real width so the chart fills whatever box
  // it's given (half-column, full row) at a fixed, crisp height.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setW(Math.max(240, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Pad the domain so a flat line doesn't sit on an edge.
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;

  const x = (i: number) =>
    data.length === 1 ? W / 2 : PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2);
  const y = (v: number) => PAD_TOP + (1 - (v - lo) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  // Soft area fill under the line, closed down to the baseline
  const baselineY = H - PAD_BOTTOM;
  const areaPath = data.length > 1
    ? `${path} L${x(data.length - 1).toFixed(1)},${baselineY} L${x(0).toFixed(1)},${baselineY} Z`
    : null;
  const fmt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;

  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="relative" ref={containerRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label={`${title}: ${data.map(d => `${shortDate(d.date)} ${fmt(d.value)}`).join(', ')}`}
        >
          {/* Recessive baseline grid */}
          <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} stroke="#e5e7eb" strokeWidth="1" />
          {/* Team-color area fill anchoring the line to the baseline */}
          {areaPath && (
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#${gradientId})`} />
            </>
          )}
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => (
            <g key={d.date}>
              {/* 2px surface ring so overlapping markers stay separable */}
              <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 5.5 : 4} fill={color} stroke="#ffffff" strokeWidth="2" />
              {/* Selective direct labels: first and last point only */}
              {(i === 0 || i === data.length - 1) && data.length > 1 && (
                <text
                  x={x(i)}
                  y={y(d.value) - 8}
                  textAnchor={i === 0 ? 'start' : 'end'}
                  className="fill-gray-700"
                  fontSize="10"
                  fontWeight="700"
                >
                  {fmt(d.value)}
                </text>
              )}
              {data.length === 1 && (
                <text x={x(i)} y={y(d.value) - 8} textAnchor="middle" className="fill-gray-700" fontSize="10" fontWeight="700">
                  {fmt(d.value)}
                </text>
              )}
              {/* Date labels under first/last */}
              {(i === 0 || i === data.length - 1) && (
                <text
                  x={x(i)}
                  y={H - 8}
                  textAnchor={data.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}
                  className="fill-gray-400"
                  fontSize="9"
                >
                  {shortDate(d.date)}
                </text>
              )}
              {/* Oversized invisible hit target for hover/tap */}
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r="12"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lg whitespace-nowrap"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              top: 0,
            }}
          >
            {shortDate(data[hover].date)}: {fmt(data[hover].value)}
          </div>
        )}
      </div>
    </div>
  );
}
