"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmailOtp, sendEmailOtp } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ui } from "@/components/ui";

function VerifyForm() {
  const [state, action, pending] = useActionState(verifyEmailOtp, {});
  const [resendState, resendAction, resending] = useActionState(sendEmailOtp, {});
  const email = useSearchParams().get("email") ?? "";

  return (
    <div className={`${ui.card} space-y-4 shadow-[0_8px_24px_rgba(16,24,40,0.08)]`}>
      <div>
        <h1 className="text-xl font-semibold">কোড যাচাই করুন</h1>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-foreground">{email}</span> -এ পাঠানো ৮-সংখ্যার কোডটি বসান।
        </p>
      </div>
      <form action={action} className="space-y-4">
        <input type="hidden" name="email" value={email} />
        <input
          name="token"
          inputMode="numeric"
          maxLength={8}
          required
          autoFocus
          placeholder="——— ———"
          className={`${ui.input} text-center text-lg tracking-[0.4em] placeholder:tracking-normal`}
        />
        {state?.error && <p className="text-sm text-error">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${ui.btn} ${ui.primary} w-full`}>
          {pending ? "যাচাই হচ্ছে…" : "যাচাই করুন"}
        </button>
      </form>

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <Link href="/login" className="text-accent">
          ← ইমেইল পরিবর্তন করুন
        </Link>
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <button type="submit" disabled={resending} className="text-accent disabled:opacity-50">
            {resending ? "পাঠানো হচ্ছে…" : "কোড আবার পাঠান"}
          </button>
        </form>
      </div>
      {resendState?.error && <p className="text-xs text-error">{resendState.error}</p>}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="text-sm text-muted">লোড হচ্ছে…</p>}>
        <VerifyForm />
      </Suspense>
    </AuthShell>
  );
}
