"use client";

import { useActionState } from "react";
import { setNewPassword } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ui } from "@/components/ui";

export default function SetPasswordPage() {
  const [state, action, pending] = useActionState(setNewPassword, {});

  return (
    <AuthShell>
      <form action={action} className={`${ui.card} space-y-4 shadow-[0_8px_24px_rgba(16,24,40,0.08)]`}>
        <div>
          <h1 className="text-xl font-semibold">একটা পাসওয়ার্ড সেট করুন</h1>
          <p className="mt-1 text-sm text-muted">
            ইমেইল যাচাই হয়ে গেছে। এখন একটা পাসওয়ার্ড সেট করুন — পরের বার থেকে কোড ছাড়াই, সরাসরি ইমেইল আর এই পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।
          </p>
        </div>
        <div>
          <label htmlFor="password" className={ui.label}>
            নতুন পাসওয়ার্ড
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoFocus
            placeholder="কমপক্ষে ৬ ক্যারেক্টার"
            className={ui.input}
          />
        </div>
        <div>
          <label htmlFor="confirm" className={ui.label}>
            পাসওয়ার্ড আবার লিখুন
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={6}
            placeholder="••••••••"
            className={ui.input}
          />
        </div>
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} w-full`}>
          {pending ? "সেট করা হচ্ছে…" : "পাসওয়ার্ড সেট করুন"}
        </button>
      </form>
    </AuthShell>
  );
}
