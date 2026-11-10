const FEATURES = [
  { icon: "📅", text: "৩০ দিনের লার্নিং + রিভিশন সাইকেল, পুরোপুরি অটোমেটিক" },
  { icon: "🤖", text: "AI দিয়ে মিনিটে একটা পূর্ণাঙ্গ স্টাডি প্ল্যান বানান" },
  { icon: "🔥", text: "প্রতিদিনের অগ্রগতি ও স্ট্রিক ট্র্যাক করুন" },
];

/** A floating, 3D-tilted planner scene: three depth-layered cards (calendar, checklist,
 * progress ring) built with CSS perspective/translateZ — the "planning" visual the marketing
 * panel is built around. Pure CSS, no JS/canvas, so it stays cheap and themeable. */
function PlannerScene() {
  return (
    <div
      aria-hidden
      className="auth-scene relative mt-10 h-[320px] w-full max-w-sm [perspective:1400px]"
    >
      {/* Ambient glow blobs for depth, behind the cards */}
      <div
        className="absolute inset-0 -z-10 opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(40% 40% at 30% 30%, color-mix(in srgb, var(--accent) 35%, transparent), transparent), radial-gradient(35% 35% at 75% 70%, color-mix(in srgb, var(--success) 25%, transparent), transparent)",
          animation: "drift-glow 9s ease-in-out infinite",
        }}
      />

      {/* Back card — mini calendar grid, pushed deep + tilted */}
      <div
        className="absolute left-1/2 top-10 h-40 w-56 rounded-2xl border border-border bg-surface/90 p-4 shadow-2xl backdrop-blur-sm"
        style={{
          transformStyle: "preserve-3d",
          animation: "float-c 7s ease-in-out infinite",
        }}
      >
        <p className="text-[11px] font-semibold text-muted">নভেম্বর ২০২৬</p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-[3px] ${
                [6, 13, 20, 24, 25].includes(i) ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Middle card — today's checklist */}
      <div
        className="absolute left-1/2 top-16 h-44 w-60 rounded-2xl border border-border bg-surface p-4 shadow-2xl"
        style={{
          transformStyle: "preserve-3d",
          animation: "float-b 8s ease-in-out infinite",
        }}
      >
        <p className="text-xs font-semibold">আজকের টাস্ক</p>
        <ul className="mt-3 space-y-2.5">
          {["বাংলা সাহিত্য — রিভিশন", "MCQ প্র্যাকটিস সেট ৪", "কারেন্ট অ্যাফেয়ার্স"].map(
            (t, i) => (
              <li key={t} className="flex items-center gap-2 text-[11px] text-muted">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                    i < 2 ? "bg-success text-white" : "border border-border"
                  }`}
                >
                  {i < 2 ? "✓" : ""}
                </span>
                <span className={i < 2 ? "line-through opacity-60" : "text-foreground"}>{t}</span>
              </li>
            ),
          )}
        </ul>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full w-2/3 rounded-full bg-accent" />
        </div>
      </div>

      {/* Front card — streak + AI badge, floats closest to viewer */}
      <div
        className="absolute left-10 top-0 flex h-28 w-44 flex-col justify-between rounded-2xl border border-border bg-surface p-3.5 shadow-2xl"
        style={{
          transformStyle: "preserve-3d",
          animation: "float-a 6s ease-in-out infinite",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base">🔥</span>
          <span className="text-sm font-bold">১২ দিন স্ট্রিক</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="30" height="30" viewBox="0 0 36 36" className="shrink-0 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeDasharray="94"
              strokeDashoffset="24"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[11px] text-muted">৭৫% সম্পন্ন</span>
        </div>
      </div>
    </div>
  );
}

/** Shared full-bleed auth layout for /login (covers signup too — same passwordless flow) and
 * /verify: a marketing panel with a 3D planner scene on wide screens, brand mark + the form
 * card everywhere. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, color-mix(in srgb, var(--accent) 18%, transparent), transparent), radial-gradient(50% 40% at 85% 90%, color-mix(in srgb, var(--accent) 12%, transparent), transparent)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-4xl items-center gap-12">
        {/* Marketing panel — desktop only */}
        <div className="hidden flex-1 lg:block">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-foreground shadow-lg shadow-accent/30">
              P
            </span>
            <span className="font-brand text-2xl font-bold tracking-tight">PLANORA</span>
          </div>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight">
            আমার কাছে হচ্ছে একটা
            <br />
            <span className="text-accent">আসল প্ল্যান।</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm text-muted">লক্ষ্যকে পরিণত করুন বাস্তব অ্যাকশনে — BCS ও অন্যান্য পরীক্ষার প্রস্তুতির জন্য।</p>

          <PlannerScene />

          <ul className="mt-6 space-y-3">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-sm text-muted">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-base shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  {f.icon}
                </span>
                <span className="pt-1.5">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm lg:mx-0">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-foreground shadow-lg shadow-accent/30">
              P
            </span>
            <span className="font-brand text-xl font-bold tracking-tight">PLANORA</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
