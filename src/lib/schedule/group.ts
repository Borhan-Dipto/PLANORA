export const HABIT_GROUP = "দৈনিক অভ্যাস";
export const BREAK_GROUP = "বিরতি";

/** Study/revision tasks grouped under their subject (in first-appearance order), habits next,
 *  break placeholders last. Plain function (no "use client") so both server components and the
 *  client TaskList can call it. */
export function groupBySubject<T extends { kind: string; subjectName: string | null; minutes: number }>(tasks: T[]) {
  const map = new Map<string, { name: string; minutes: number; tasks: T[] }>();
  const habits: T[] = [];
  const breaks: T[] = [];
  for (const t of tasks) {
    if (t.kind === "break") {
      breaks.push(t);
      continue;
    }
    if (t.kind === "habit" || !t.subjectName) {
      habits.push(t);
      continue;
    }
    const g = map.get(t.subjectName) ?? { name: t.subjectName, minutes: 0, tasks: [] };
    g.minutes += t.minutes;
    g.tasks.push(t);
    map.set(t.subjectName, g);
  }
  const out = [...map.values()];
  if (habits.length) out.push({ name: HABIT_GROUP, minutes: 0, tasks: habits });
  if (breaks.length) out.push({ name: BREAK_GROUP, minutes: 0, tasks: breaks });
  return out;
}
