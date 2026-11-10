/** Shared Tailwind class strings — keeps every screen visually consistent and responsive. */
export const ui = {
  card: "rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5",
  input:
    "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60",
  label: "mb-1 block text-xs font-medium text-muted",
  btn: "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
  primary: "bg-accent text-accent-foreground shadow-sm shadow-accent/30 hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground hover:border-accent/50 hover:bg-background",
  danger: "border border-error/40 text-error hover:bg-error/10",
  ghost: "text-muted hover:text-foreground",
};

export const DIFFICULTY_LABEL = { easy: "সহজ", medium: "মাঝারি", hard: "কঠিন" } as const;
export const WEEKDAY_LABEL = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
export const STATUS_LABEL = { draft: "ড্রাফট", active: "চলমান", completed: "সম্পন্ন", archived: "আর্কাইভড" } as const;
export const SOURCE_LABEL = { manual: "ম্যানুয়াল", ai_chat: "AI চ্যাট", automatic: "অটোমেটিক" } as const;

export function fmtMinutes(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} মি.`;
  return r ? `${h} ঘ. ${r} মি.` : `${h} ঘ.`;
}
