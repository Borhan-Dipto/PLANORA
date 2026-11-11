"use client";

import { useActionState } from "react";
import { continueLogin, sendEmailOtp } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ui } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(continueLogin, {});
  const [resendState, resendAction, resending] = useActionState(sendEmailOtp, {});
  const showPassword = state?.step === "password";

  return (
    <AuthShell>
      <form action={action} className={`${ui.card} space-y-4 shadow-[0_8px_24px_rgba(16,24,40,0.08)]`}>
        <div>
          <h1 className="text-xl font-semibold">লগইন করুন বা নতুন অ্যাকাউন্ট খুলুন</h1>
          <p className="mt-1 text-sm text-muted">
            {showPassword
              ? "এই ইমেইলে আগে থেকেই পাসওয়ার্ড সেট করা আছে — পাসওয়ার্ড দিয়ে লগইন করুন।"
              : "ইমেইল দিন — নতুন হলে একটা কোড পাঠাব, আগে থেকে পাসওয়ার্ড সেট থাকলে সরাসরি পাসওয়ার্ড চাইব।"}
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
            autoFocus={!showPassword}
            readOnly={showPassword}
            defaultValue={state?.email ?? ""}
            placeholder="you@example.com"
            className={ui.input}
          />
        </div>
        {showPassword && (
          <div>
            <label htmlFor="password" className={ui.label}>
              পাসওয়ার্ড
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              placeholder="••••••••"
              className={ui.input}
            />
          </div>
        )}
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} w-full`}>
          {pending ? "এগিয়ে যাওয়া হচ্ছে…" : showPassword ? "লগইন করুন" : "পরবর্তী পদক্ষেপ"}
        </button>
        {showPassword ? (
          <div className="text-center text-xs">
            <button
              type="submit"
              formAction={resendAction}
              disabled={resending}
              className="text-accent disabled:opacity-50"
            >
              {resending ? "পাঠানো হচ্ছে…" : "পাসওয়ার্ড ভুলে গেছেন? কোড দিয়ে লগইন করুন"}
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted">
            নতুন ইমেইল হলে কোড যাচাইয়ের পর একটা পাসওয়ার্ড সেট করতে বলা হবে — তারপর থেকে সরাসরি পাসওয়ার্ড দিয়েই লগইন করতে পারবেন।
          </p>
        )}
        {resendState?.error && <p className="text-center text-xs text-error">{resendState.error}</p>}
      </form>
    </AuthShell>
  );
}
