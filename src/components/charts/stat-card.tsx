/** Premium insights stat tile: icon chip, big number, tinted glow background, and a delta line
 * vs the previous period. `tint` sets the glow colour (see .insight-card in globals.css). */
export function StatCard({
  icon,
  tint,
  value,
  label,
  delta,
  deltaGood,
}: {
  icon: React.ReactNode;
  tint: string;
  value: React.ReactNode;
  label: string;
  delta?: string;
  deltaGood?: boolean;
}) {
  return (
    <div className="insight-card rounded-2xl border border-border bg-surface p-4" style={{ ["--tint" as string]: tint }}>
      <div
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-base"
        style={{ background: `color-mix(in srgb, ${tint} 22%, transparent)`, color: tint }}
      >
        {icon}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
      {delta && (
        <p className={`mt-2 text-xs font-medium ${deltaGood === false ? "text-error" : deltaGood ? "text-success" : "text-muted"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}
