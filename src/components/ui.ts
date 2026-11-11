/** Shared Tailwind class strings — keeps every screen visually consistent and responsive. */
export const ui = {
  card: "rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5",
  input:
    "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60",
  label: "mb-1 block text-xs font-medium text-muted",
  btn: "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-50",
  primary:
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_85%,white),var(--accent))] text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(16,24,40,0.08),0_10px_20px_-10px_var(--accent)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(16,24,40,0.08),0_14px_24px_-10px_var(--accent)] hover:-translate-y-px",
  secondary:
    "border border-border bg-surface text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-accent/50 hover:bg-background hover:-translate-y-px",
  danger: "border border-error/40 text-error hover:bg-error/10",
  ghost: "text-muted hover:text-foreground hover:bg-background",
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
