"use client";

import { useActionState } from "react";
import { sendEmailOtp } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendEmailOtp, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-bold text-accent-foreground">
            P
          </span>
          <h1 className="font-brand text-2xl font-bold tracking-tight text-foreground">PLANORA</h1>
        </div>
        <p className="text-sm text-muted">আপনার ইমেইল দিন, আমরা একটা কোড পাঠাব।</p>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground shadow-sm shadow-accent/30 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "পাঠানো হচ্ছে..." : "কোড পাঠান"}
        </button>
      </form>
    </main>
  );
}
