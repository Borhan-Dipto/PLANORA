/** Static SVG donut (ring) chart — e.g. subject time-distribution. Server-safe: no interactivity,
 * just the stroke-dasharray-per-segment trick used elsewhere in the app for progress rings. */
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const size = 160;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  const arcs = segments
    .filter((s) => s.value > 0)
    .reduce<{ label: string; value: number; color: string; dash: number; offset: number }[]>((acc, s) => {
      const frac = s.value / total;
      const dash = frac * circumference;
      const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
      acc.push({ ...s, dash, offset });
      return acc;
    }, []);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="বিষয়ভিত্তিক সময় বণ্টন">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={a.color}
          strokeWidth={stroke}
          strokeDasharray={`${a.dash} ${circumference - a.dash}`}
          strokeDashoffset={-a.offset}
          strokeLinecap="butt"
        />
      ))}
      {(centerLabel || centerValue) && (
        <g style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
          {centerValue && (
            <text x={c} y={c - 4} textAnchor="middle" fontSize="20" fontWeight={700} fill="var(--foreground)">
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text x={c} y={c + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
