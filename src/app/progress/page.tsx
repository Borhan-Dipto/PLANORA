import Link from "next/link";
import { and, eq, inArray, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getActivePlan, missedCount, todayFor } from "@/lib/schedule/service";
import { cycleEnd } from "@/lib/schedule/engine";
import { PageFrame } from "@/components/page-frame";
import { ui, fmtMinutes, WEEKDAY_LABEL } from "@/components/ui";
import { WeeklyBarChart } from "@/components/charts/weekly-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { StatCard } from "@/components/charts/stat-card";

const SUBJECT_COLORS = ["var(--chart-blue)", "var(--chart-violet)", "var(--chart-teal)", "var(--chart-amber)", "var(--chart-rose)"];

function dayNumber(start: string, today: string) {
  return Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
}
function daysUntil(today: string, date: string) {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-background">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export default async function ProgressPage() {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  const active = await getActivePlan(userId, today);

  if (!active) {
    return (
      <PageFrame title="অগ্রগতি">
        <div className={`${ui.card} text-center text-muted`}>
          <p>অগ্রগতি দেখতে আগে একটা চলমান প্ল্যান দরকার।</p>
          <Link href="/planner" className={`${ui.btn} ${ui.primary} mt-4`}>
            প্ল্যান বানান
          </Link>
        </div>
      </PageFrame>
    );
  }

  const plan = active.planData;
  const since14 = addDays(today, -13);

  const [subjectRows, [study], [revision], dayRows, missed, last14Rows] = await Promise.all([
    db
      .select({
        subjectId: planTasks.subjectId,
        total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
        done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study")))
      .groupBy(planTasks.subjectId),
    db
      .select({
        total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
        done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study"))),
    db
      .select({
        total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
        done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "revision"))),
    db
      .select({
        date: planTasks.date,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${planTasks.status} = 'done')::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), inArray(planTasks.kind, ["study", "habit", "revision"]), lte(planTasks.date, today)))
      .groupBy(planTasks.date)
      .orderBy(desc(planTasks.date)),
    missedCount(active.id, today),
    db
      .select({
        date: planTasks.date,
        minutes: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study"), gte(planTasks.date, since14), lte(planTasks.date, today)))
      .groupBy(planTasks.date),
  ]);

  const bySubject = new Map(subjectRows.map((r) => [r.subjectId, r]));

  // last 14 real calendar days (today inclusive), oldest → newest, zero-filled for days with no rows
  const minutesByDate = new Map(last14Rows.map((r) => [r.date, r.minutes]));
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(since14, i);
    return { date, minutes: minutesByDate.get(date) ?? 0 };
  });
  const thisWeek = last14.slice(7);
  const lastWeekSlice = last14.slice(0, 7);
  const thisWeekMinutes = thisWeek.reduce((s, d) => s + d.minutes, 0);
  const lastWeekMinutes = lastWeekSlice.reduce((s, d) => s + d.minutes, 0);
  const weekDeltaMinutes = thisWeekMinutes - lastWeekMinutes;
  const thisWeekProductiveDays = thisWeek.filter((d) => d.minutes > 0).length;
  const lastWeekProductiveDays = lastWeekSlice.filter((d) => d.minutes > 0).length;
  const weeklyChartData = thisWeek.map((d) => ({
    label: WEEKDAY_LABEL[new Date(d.date + "T00:00:00Z").getUTCDay()],
    value: d.minutes,
  }));

  const subjectDonut = plan.subjects
    .map((s, i) => {
      const r = bySubject.get(s.id);
      return { label: s.name, value: r?.done && r.done > 0 ? r.done : r?.total ?? 0, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length] };
    })
    .filter((s) => s.value > 0);
  const subjectDonutTotal = subjectDonut.reduce((s, x) => s + x.value, 0);

  let streak = 0;
  for (const row of dayRows) {
    if (row.date === today && row.done < row.total) continue; // today not finished yet — doesn't break or count
    if (row.total > 0 && row.done === row.total) streak++;
    else break;
  }

  const overallPercent = study.total ? Math.round((study.done / study.total) * 100) : 0;
  const revisionStarted = today > cycleEnd(plan) || revision.total > 0;
  const dayNo = dayNumber(plan.startDate, today);
  const totalDays = plan.learningDays + plan.revisionDays;
  const examLeft = plan.examDate ? daysUntil(today, plan.examDate) : null;

  // Forecast (heuristic, not ML): at the pace kept so far, will the remaining work fit in the
  // time left before the exam? Simple linear projection from elapsed-days vs done-minutes.
  const elapsedDays = Math.max(1, Math.min(dayNo, totalDays));
  const dailyPace = study.done / elapsedDays;
  const remainingMinutes = Math.max(0, study.total - study.done);
  const daysNeeded = dailyPace > 0 ? Math.ceil(remainingMinutes / dailyPace) : remainingMinutes > 0 ? null : 0;
  const daysLeftInCycle = Math.max(0, totalDays - dayNo);
  const onTrack = daysNeeded !== null && remainingMinutes === 0 ? true : daysNeeded !== null ? daysNeeded <= daysLeftInCycle : false;
  const forecastGapDays = daysNeeded !== null ? daysNeeded - daysLeftInCycle : null;

  const subjectPercents = plan.subjects
    .map((s) => {
      const r = bySubject.get(s.id);
      const total = r?.total ?? 0;
      const done = r?.done ?? 0;
      return { name: s.name, percent: total ? Math.round((done / total) * 100) : 0, total };
    })
    .filter((s) => s.total > 0);
  const weakestSubject = subjectPercents.length ? subjectPercents.reduce((a, b) => (b.percent < a.percent ? b : a)) : null;

  const weekDeltaLabel =
    lastWeekMinutes === 0 && thisWeekMinutes === 0
      ? undefined
      : `${weekDeltaMinutes >= 0 ? "+" : ""}${fmtMinutes(Math.abs(weekDeltaMinutes))} গত সপ্তাহের তুলনায়`;
  const dayDeltaLabel = `${thisWeekProductiveDays - lastWeekProductiveDays >= 0 ? "+" : ""}${thisWeekProductiveDays - lastWeekProductiveDays} দিন গত সপ্তাহের তুলনায়`;

  return (
    <PageFrame title="অগ্রগতি" actions={<span className="shrink-0 rounded-full bg-background px-3 py-1 text-xs text-muted">এই সপ্তাহ</span>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            tint="var(--chart-blue)"
            icon="⏱️"
            value={fmtMinutes(thisWeekMinutes)}
            label="এই সপ্তাহে পড়াশোনা"
            delta={weekDeltaLabel}
            deltaGood={weekDeltaMinutes >= 0}
          />
          <StatCard
            tint="var(--chart-violet)"
            icon="🔥"
            value={`${thisWeekProductiveDays}/৭`}
            label="প্রোডাক্টিভ দিন"
            delta={dayDeltaLabel}
            deltaGood={thisWeekProductiveDays - lastWeekProductiveDays >= 0}
          />
        </div>

        <div className={ui.card}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">সাপ্তাহিক ফোকাস সময়</h2>
            <span className="text-xs text-muted">গত ৭ দিন</span>
          </div>
          <WeeklyBarChart data={weeklyChartData} />
        </div>

        {subjectDonutTotal > 0 && (
          <div className={ui.card}>
            <h2 className="mb-4 font-semibold">বিষয়ভিত্তিক সময় বণ্টন</h2>
            <div className="flex flex-wrap items-center gap-6">
              <DonutChart segments={subjectDonut} centerValue={`${Math.round(subjectDonutTotal / 60)} ঘ.`} centerLabel="মোট" />
              <ul className="min-w-[160px] flex-1 space-y-2 text-sm">
                {subjectDonut.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 font-medium text-muted">{Math.round((s.value / subjectDonutTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className={`insight-card ${ui.card}`} style={{ ["--tint" as string]: onTrack ? "var(--success)" : "var(--warning)" }}>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <span>🔮</span> পূর্বাভাস
          </h2>
          {remainingMinutes === 0 ? (
            <p className="text-sm text-success">লার্নিং সাইকেলের সব টাস্ক শেষ — অভিনন্দন! 🎉</p>
          ) : daysNeeded === null ? (
            <p className="text-sm text-muted">পূর্বাভাস দিতে আর কয়েকদিন ডেটা দরকার — পড়াশোনা চালিয়ে যান।</p>
          ) : onTrack ? (
            <p className="text-sm">
              বর্তমান গতিতে চললে লার্নিং আপনি <span className="font-semibold text-success">সময়ের মধ্যেই শেষ করবেন</span> (বাকি কাজ শেষ হতে
              প্রায় {daysNeeded} দিন লাগবে, হাতে আছে {daysLeftInCycle} দিন)।
            </p>
          ) : (
            <p className="text-sm">
              বর্তমান গতিতে চললে বাকি কাজ শেষ করতে প্রায় {daysNeeded} দিন লাগবে, কিন্তু হাতে আছে {daysLeftInCycle} দিন —{" "}
              <span className="font-semibold text-warning">প্রায় {forecastGapDays} দিন পিছিয়ে</span>। দৈনিক পড়ার সময় একটু বাড়ালে ধরে ফেলা সম্ভব।
            </p>
          )}
          {weakestSubject && weakestSubject.percent < 50 && (
            <p className="mt-2 text-xs text-muted">
              সবচেয়ে পিছিয়ে থাকা বিষয়: <span className="font-medium text-foreground">{weakestSubject.name}</span> ({weakestSubject.percent}%
              সম্পন্ন) — এখানে একটু বাড়তি সময় দিন।
            </p>
          )}
        </div>

        <div className={ui.card}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">সার্বিক অগ্রগতি (লার্নিং)</span>
            <span className="text-muted">
              {overallPercent}% · {fmtMinutes(study.done)} / {fmtMinutes(study.total)}
            </span>
          </div>
          <div className="mt-2">
            <Bar percent={overallPercent} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>দিন {Math.max(1, Math.min(dayNo, totalDays))}/{totalDays}</span>
            {examLeft !== null && <span>{examLeft >= 0 ? `পরীক্ষার বাকি ${examLeft} দিন` : "পরীক্ষা শেষ"}</span>}
            {missed > 0 && (
              <Link href="/dashboard" className="text-error">
                মিস করা টাস্ক {missed}টি →
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={ui.card}>
            <p className="text-xs text-muted">🔥 ধারাবাহিক দিন (স্ট্রিক)</p>
            <p className="mt-1 text-2xl font-semibold">{streak}</p>
          </div>
          <div className={ui.card}>
            <p className="text-xs text-muted">🔁 রিভিশন অগ্রগতি</p>
            <p className="mt-1 text-2xl font-semibold">{revision.total ? Math.round((revision.done / revision.total) * 100) : 0}%</p>
          </div>
        </div>

        <div className={ui.card}>
          <h2 className="mb-3 font-semibold">বিষয়ভিত্তিক অগ্রগতি</h2>
          <div className="space-y-4">
            {plan.subjects.map((s) => {
              const r = bySubject.get(s.id);
              const total = r?.total ?? 0;
              const done = r?.done ?? 0;
              const percent = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {percent}% · {fmtMinutes(done)} / {fmtMinutes(total)}
                    </span>
                  </div>
                  <Bar percent={percent} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/revision" className="text-accent">
            রিভিশন দেখুন →
          </Link>
          <Link href={`/planner/${active.id}/schedule`} className="text-accent">
            পুরো সময়সূচি দেখুন →
          </Link>
        </div>
        {!revisionStarted && (
          <p className="text-center text-xs text-muted">লার্নিং সাইকেল শেষ হলে রিভিশন অগ্রগতি এখানে যোগ হবে।</p>
        )}
      </div>
    </PageFrame>
  );
}
