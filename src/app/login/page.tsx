"use client";

import { useActionState } from "react";
import { sendEmailOtp } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendEmailOtp, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-accent">PLANORA</h1>
        <p className="text-sm text-muted">আপনার ইমেইল দিন, আমরা একটা কোড পাঠাব।</p>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-accent"
        />
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground disabled:opacity-50"
        >
          {pending ? "পাঠানো হচ্ছে..." : "কোড পাঠান"}
        </button>
      </form>
    </main>
  );
}
