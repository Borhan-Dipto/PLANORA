"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyEmailOtp } from "@/lib/actions/auth";

function VerifyForm() {
  const [state, action, pending] = useActionState(verifyEmailOtp, {});
  const email = useSearchParams().get("email") ?? "";

  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">কোড যাচাই করুন</h1>
      <p className="text-sm text-muted">{email} -এ পাঠানো কোড দিন।</p>
      <input type="hidden" name="email" value={email} />
      <input
        name="token"
        inputMode="text"
        maxLength={8}
        required
        placeholder="কোড পেস্ট করুন"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-accent"
      />
      {state?.error && <p className="text-sm text-error">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground disabled:opacity-50"
      >
        {pending ? "যাচাই হচ্ছে..." : "যাচাই করুন"}
      </button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Suspense fallback={<p className="text-muted">Loading...</p>}>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
