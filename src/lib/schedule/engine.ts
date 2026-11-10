import { addDays, type PlanData } from "@/lib/plan/schema";

/**
 * Deterministic scheduling engine (pure — no I/O, fully testable).
 * Spreads the remaining study minutes of every topic across the remaining study days of the 30-day
 * learning window, interleaving subjects in proportion to their priority, keeping each subject's
 * topic order, and splitting only topics that are larger than a day.
 */

export type NewTask = {
  date: string;
  kind: "study" | "habit" | "revision";
  subjectId: string | null;
  topicId: string | null;
  subjectName: string | null;
  title: string;
  minutes: number;
  part: number;
  parts: number;
  sort: number;
};

export type ScheduleResult = {
  tasks: NewTask[];
  /** Minutes per study day the engine had to use (> dailyStudyMinutes ⇒ overloaded). */
  capacity: number;
  overloaded: boolean;
  studyDays: number;
};

export function learningEnd(plan: PlanData) {
  return addDays(plan.startDate, plan.learningDays - 1);
}
export function cycleEnd(plan: PlanData) {
  return addDays(plan.startDate, plan.learningDays + plan.revisionDays - 1);
}

export function datesBetween(from: string, to: string, weekdays: number[]) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (weekdays.includes(new Date(d + "T00:00:00Z").getUTCDay())) out.push(d);
  }
  return out;
}

export const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function buildSchedule(
  plan: PlanData,
  from: string,
  /** topicId → minutes still to study (missing = full estimate) */
  remaining: Map<string, number> = new Map(),
  /** schedule habits from this date (defaults to `from`) */
  habitsFrom: string = from,
  /** dates the user has manually fixed — the auto-engine skips placing study tasks on these */
  lockedDates: Set<string> = new Set()
): ScheduleResult {
  const start = from < plan.startDate ? plan.startDate : from;
  const days = datesBetween(start, learningEnd(plan), plan.studyWeekdays).filter((d) => !lockedDates.has(d));

  // Per-subject queues of what is left, in the user's order.
  const queues = plan.subjects
    .map((s, idx) => ({
      idx,
      id: s.id,
      name: s.name,
      weight: Math.max(1, s.priority),
      vt: 0,
      topics: s.topics
        .map((t) => {
          const left = remaining.has(t.id) ? remaining.get(t.id)! : t.estimatedMinutes;
          return { id: t.id, name: t.name, left, partial: left < t.estimatedMinutes };
        })
        .filter((t) => t.left > 0),
    }))
    .filter((q) => q.topics.length);

  const total = queues.reduce((n, q) => n + q.topics.reduce((m, t) => m + t.left, 0), 0);

  // Weighted fair interleave: the subject that has received the least time relative to its priority goes next.
  const order: { q: (typeof queues)[number]; t: (typeof queues)[number]["topics"][number] }[] = [];
  for (;;) {
    const live = queues.filter((q) => q.topics.length);
    if (!live.length) break;
    live.sort((a, b) => a.vt - b.vt || b.weight - a.weight || a.idx - b.idx);
    const q = live[0];
    const t = q.topics.shift()!;
    q.vt += t.left / q.weight;
    order.push({ q, t });
  }

  const tasks: NewTask[] = [];
  let day = 0;
  let used = 0;
  let sort = 0;
  let placed = 0;
  let maxDay = 0;
  const dayTotals = new Map<string, number>();
  // Cumulative "ideal" minutes that should be done by the end of day d — keeps the error from piling up.
  const ideal = (d: number) => (total * (d + 1)) / days.length;

  if (days.length) {
    for (const { q, t } of order) {
      let left = t.left;
      const chunks: NewTask[] = [];
      while (left > 0) {
        const last = day >= days.length - 1;
        const need = ideal(day) - placed; // what today still needs
        let chunk: number;
        if (last) chunk = left;
        else if (used === 0) chunk = left <= Math.max(need, 30) * 1.5 ? left : round5(Math.max(need, 30)); // split big topics
        else if (placed + left / 2 <= ideal(day)) chunk = left > need + 60 && need >= 30 ? round5(need) : left;
        else {
          day++;
          used = 0;
          continue;
        }
        const date = days[Math.min(day, days.length - 1)];
        chunks.push({
          date,
          kind: "study",
          subjectId: q.id,
          topicId: t.id,
          subjectName: q.name,
          title: t.partial ? `${t.name} (বাকি অংশ)` : t.name,
          minutes: chunk,
          part: chunks.length + 1,
          parts: 1,
          sort: sort++,
        });
        left -= chunk;
        placed += chunk;
        used += chunk;
        dayTotals.set(date, (dayTotals.get(date) ?? 0) + chunk);
        maxDay = Math.max(maxDay, dayTotals.get(date)!);
        if (placed >= ideal(day) && !last) {
          day++;
          used = 0;
        }
      }
      chunks.forEach((c) => (c.parts = chunks.length));
      tasks.push(...chunks);
    }
  }

  // Daily habits on every study day of the whole cycle (learning + revision).
  const targets = (plan.dailyTargets ?? []).filter(Boolean);
  if (targets.length) {
    const hStart = habitsFrom < plan.startDate ? plan.startDate : habitsFrom;
    for (const d of datesBetween(hStart, cycleEnd(plan), plan.studyWeekdays)) {
      targets.forEach((title, i) =>
        tasks.push({
          date: d,
          kind: "habit",
          subjectId: null,
          topicId: null,
          subjectName: null,
          title,
          minutes: 0,
          part: 1,
          parts: 1,
          sort: 100_000 + i,
        })
      );
    }
  }

  const capacity = Math.max(maxDay, plan.dailyStudyMinutes);
  // Small spill-over (≤ 15%) from whole-topic packing is normal; more than that means the plan doesn't fit.
  return { tasks, capacity, overloaded: maxDay > plan.dailyStudyMinutes * 1.15, studyDays: days.length };
}

const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 } as const;
/** Revision is a second pass, not a repeat of day one — a fraction of the original study time is enough. */
const REVISION_RATIO = 0.35;
const MIN_REVISION_MINUTES = 10;

/**
 * Builds the revision-day tasks (every topic in the plan, once), for the revision window
 * (the days after `learningEnd` through `cycleEnd`). Harder topics and higher-priority subjects
 * are scheduled earlier in the window — while the most revision time is still left before the
 * exam — and get more minutes. If everything doesn't fit in the available revision days at full
 * strength, every topic's time is scaled down proportionally rather than dropping any topic.
 */
export function buildRevisionTasks(plan: PlanData, from: string, lockedDates: Set<string> = new Set()): NewTask[] {
  const windowStart = addDays(learningEnd(plan), 1);
  const start = from > windowStart ? from : windowStart;
  const end = cycleEnd(plan);
  if (start > end) return [];
  const days = datesBetween(start, end, plan.studyWeekdays).filter((d) => !lockedDates.has(d));
  if (!days.length) return [];

  const items = plan.subjects.flatMap((s) =>
    s.topics.map((t) => ({
      subjectId: s.id,
      subjectName: s.name,
      topicId: t.id,
      title: t.name,
      minutes: Math.max(MIN_REVISION_MINUTES, round5(t.estimatedMinutes * REVISION_RATIO)),
      weight: DIFFICULTY_WEIGHT[t.difficulty] * Math.max(1, s.priority),
    }))
  );
  if (!items.length) return [];

  const totalRaw = items.reduce((n, it) => n + it.minutes, 0);
  const budget = days.length * plan.dailyStudyMinutes;
  const scale = totalRaw > budget ? budget / totalRaw : 1;
  if (scale < 1) items.forEach((it) => (it.minutes = Math.max(MIN_REVISION_MINUTES, round5(it.minutes * scale))));

  // Hardest / highest-priority topics first, so they land earliest in the revision window.
  items.sort((a, b) => b.weight - a.weight);

  const tasks: NewTask[] = [];
  let day = 0;
  let used = 0;
  let sort = 0;
  for (const it of items) {
    if (day < days.length - 1 && used > 0 && used + it.minutes > plan.dailyStudyMinutes * 1.1) {
      day++;
      used = 0;
    }
    tasks.push({
      date: days[Math.min(day, days.length - 1)],
      kind: "revision",
      subjectId: it.subjectId,
      topicId: it.topicId,
      subjectName: it.subjectName,
      title: `🔁 ${it.title}`,
      minutes: it.minutes,
      part: 1,
      parts: 1,
      sort: sort++,
    });
    used += it.minutes;
    if (day < days.length - 1 && used >= plan.dailyStudyMinutes) {
      day++;
      used = 0;
    }
  }
  return tasks;
}
