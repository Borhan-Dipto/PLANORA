import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { plans } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { analyzePlan } from "@/lib/plan/schema";
import { PageFrame } from "@/components/page-frame";
import { PlanStatsBar, IssueList } from "@/components/planner/plan-summary";
import { PlanActions } from "@/components/planner/plan-actions";
import { DownloadJsonButton } from "@/components/planner/download-json-button";
import { ui, DIFFICULTY_LABEL, STATUS_LABEL, SOURCE_LABEL, WEEKDAY_LABEL, fmtMinutes } from "@/components/ui";

const DIFF_TONE = { easy: "text-success", medium: "text-warning", hard: "text-error" } as const;

export default async function PlanPreviewPage({ params }: PageProps<"/planner/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, userId)));
  if (!plan) notFound();

  const d = plan.planData;
  const { issues, stats } = analyzePlan(d);
  const canApprove = !issues.some((i) => i.level === "error");

  return (
    <PageFrame title={plan.title} back="/planner">
      <div className="space-y-4">
        <section className={ui.card}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">{STATUS_LABEL[plan.status]}</span>
            <span className="text-muted">{SOURCE_LABEL[plan.source]} প্ল্যান</span>
          </div>
          {d.goal && <p className="mt-3 text-sm">{d.goal}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Info k="শুরু" v={d.startDate} />
            <Info k="শেষ" v={stats.endDate} />
            <Info k="সাইকেল" v={`৩০ + ${d.revisionDays} দিন`} />
            <Info k="দৈনিক" v={fmtMinutes(d.dailyStudyMinutes)} />
            {d.examDate && <Info k="পরীক্ষা" v={d.examDate} />}
            <Info k="পড়ার দিন" v={d.studyWeekdays.length === 7 ? "প্রতিদিন" : d.studyWeekdays.map((w) => WEEKDAY_LABEL[w]).join(", ")} />
          </dl>
          {(d.dailyTargets?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs text-muted">দৈনিক লক্ষ্য</p>
              <ul className="mt-1 space-y-1 text-sm">
                {d.dailyTargets!.map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <PlanStatsBar stats={stats} />
        <IssueList issues={issues} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <PlanActions id={plan.id} title={plan.title} status={plan.status} canApprove={canApprove} />
          </div>
          <DownloadJsonButton plan={d} />
        </div>

        {[...d.subjects]
          .sort((a, b) => b.priority - a.priority)
          .map((s) => (
            <section key={s.id} className={ui.card}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{s.name}</h2>
                  {s.course && <p className="text-xs text-muted">{s.course}</p>}
                </div>
                <span className="text-xs text-warning" title="গুরুত্ব">{"★".repeat(s.priority)}</span>
                <span className="text-xs text-muted">
                  {s.topics.length} টপিক · {fmtMinutes(s.topics.reduce((n, t) => n + t.estimatedMinutes, 0))}
                </span>
              </div>
              <ol className="divide-y divide-border">
                {s.topics.map((t, i) => (
                  <li key={t.id} className="flex items-start gap-2 py-2 text-sm">
                    <span className="w-6 shrink-0 text-xs text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1 break-words">{t.name}</span>
                    <span className={`shrink-0 text-xs ${DIFF_TONE[t.difficulty]}`}>{DIFFICULTY_LABEL[t.difficulty]}</span>
                    <span className="w-16 shrink-0 text-right text-xs text-muted">{fmtMinutes(t.estimatedMinutes)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
      </div>
    </PageFrame>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}
