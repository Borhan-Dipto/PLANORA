"use client";

import { useActionState } from "react";
import { sendEmailOtp } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ui } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendEmailOtp, {});

  return (
    <AuthShell>
      <form action={action} className={`${ui.card} space-y-4 shadow-[0_8px_24px_rgba(16,24,40,0.08)]`}>
        <div>
          <h1 className="text-xl font-semibold">লগইন করুন বা নতুন অ্যাকাউন্ট খুলুন</h1>
          <p className="mt-1 text-sm text-muted">
            পাসওয়ার্ড লাগবে না — ইমেইল দিন, আমরা একটা ৬-সংখ্যার কোড পাঠাব। নতুন ইমেইল হলে সাথে সাথে নতুন অ্যাকাউন্টও তৈরি হয়ে যাবে।
          </p>
        </div>
        <div>
          <label htmlFor="email" className={ui.label}>
            ইমেইল
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            className={ui.input}
          />
        </div>
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} w-full`}>
          {pending ? "পাঠানো হচ্ছে…" : "কোড পাঠান"}
        </button>
        <p className="text-center text-xs text-muted">
          কোড পাঠানোর মাধ্যমেই আপনার ইমেইল যাচাই (ভেরিফাই) হয়ে যায় — আলাদা কিছু করতে হবে না।
        </p>
      </form>
    </AuthShell>
  );
}
