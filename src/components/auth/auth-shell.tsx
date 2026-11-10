const FEATURES = [
  { icon: "📅", text: "৩০ দিনের লার্নিং + রিভিশন সাইকেল, পুরোপুরি অটোমেটিক" },
  { icon: "🤖", text: "AI দিয়ে মিনিটে একটা পূর্ণাঙ্গ স্টাডি প্ল্যান বানান" },
  { icon: "🔥", text: "প্রতিদিনের অগ্রগতি ও স্ট্রিক ট্র্যাক করুন" },
];

/** Shared full-bleed auth layout for /login (covers signup too — same passwordless flow) and
 * /verify: a marketing panel on wide screens, brand mark + the form card everywhere. */
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
          <ul className="mt-8 space-y-4">
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
