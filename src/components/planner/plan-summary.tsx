import type { PlanIssue, PlanStats } from "@/lib/plan/schema";
import { ui, fmtMinutes } from "@/components/ui";

export function PlanStatsBar({ stats }: { stats: PlanStats }) {
  const over = stats.loadPercent > 100;
  const items = [
    { label: "মোট টপিক", value: String(stats.totalTopics) },
    { label: "দরকারি সময়", value: fmtMinutes(stats.totalMinutes) },
    { label: "হাতে সময়", value: fmtMinutes(stats.availableMinutes) },
    { label: "লোড", value: `${stats.loadPercent}%`, tone: over ? "text-error" : stats.loadPercent > 85 ? "text-warning" : "text-success" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className={`${ui.card} p-3 sm:p-4`}>
          <p className="text-xs text-muted">{i.label}</p>
          <p className={`mt-1 text-lg font-semibold ${i.tone ?? ""}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}

export function IssueList({ issues }: { issues: PlanIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="space-y-2">
      {issues.map((i, k) => (
        <li
          key={k}
          className={`rounded-lg border px-3 py-2 text-sm ${
            i.level === "error" ? "border-error/40 bg-error/10 text-error" : "border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          {i.level === "error" ? "⛔ " : "⚠️ "}
          {i.message}
        </li>
      ))}
    </ul>
  );
}
