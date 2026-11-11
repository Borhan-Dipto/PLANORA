"use client";

import { useId, useState } from "react";

/** Bar + trend-line chart for "this week's focus hours" — mirrors the reference insights screen:
 * gradient bars, a connecting trend line with dots, and a tap/hover tooltip on each bar. Pure SVG,
 * sized by viewBox so it scales with its container (no fixed px width needed from the caller). */
export function WeeklyBarChart({
  data,
  unitLabel = "মি.",
}: {
  data: { label: string; value: number }[];
  unitLabel?: string;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const w = 700;
  const h = 220;
  const padTop = 36;
  const padBottom = 28;
  const padX = 20;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const slot = (w - padX * 2) / n;
  const barW = Math.min(34, slot * 0.5);
  const plotH = h - padTop - padBottom;

  const points = data.map((d, i) => {
    const x = padX + slot * i + slot / 2;
    const y = padTop + plotH - (d.value / max) * plotH;
    return { x, y, d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" role="img" aria-label="সাপ্তাহিক ফোকাস সময়ের চার্ট">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-light)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--accent) 55%, transparent)" />
          </linearGradient>
        </defs>

        {points.map((p, i) => {
          const barH = Math.max(3, (p.d.value / max) * plotH);
          const isActive = active === i;
          return (
            <g key={i} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} className="cursor-pointer">
              <rect x={p.x - barW / 2} y={h - padBottom - barH} width={barW} height={barH} rx={barW / 2.6} fill={`url(#${gradientId})`} opacity={isActive ? 1 : 0.85} />
              <rect x={p.x - slot / 2} y={0} width={slot} height={h} fill="transparent" />
              <text x={p.x} y={h - 6} textAnchor="middle" fontSize="13" fill="var(--muted)">
                {p.d.label}
              </text>
            </g>
          );
        })}

        <path d={linePath} fill="none" stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={active === i ? 5 : 3.5} fill={active === i ? "var(--accent-light)" : "var(--foreground)"} fillOpacity={active === i ? 1 : 0.6} />
        ))}

        {active !== null && (
          <g transform={`translate(${Math.min(Math.max(points[active].x - 34, padX), w - padX - 68)}, ${Math.max(points[active].y - 38, 0)})`}>
            <rect width={68} height={28} rx={8} fill="var(--surface-elevated)" stroke="var(--border)" />
            <text x={34} y={18} textAnchor="middle" fontSize="13" fontWeight={600} fill="var(--foreground)">
              {data[active].value} {unitLabel}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
