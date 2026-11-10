"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyEmailOtp } from "@/lib/actions/auth";

function VerifyForm() {
  const [state, action, pending] = useActionState(verifyEmailOtp, {});
  const email = useSearchParams().get("email") ?? "";

  return (
    <form action={action} className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">কোড যাচাই করুন</h1>
      <p className="text-sm text-gray-500">{email} -এ পাঠানো ৬ সংখ্যার কোড দিন।</p>
      <input type="hidden" name="email" value={email} />
      <input
        name="token"
        inputMode="text"
        maxLength={8}
        required
        placeholder="কোড পেস্ট করুন"
        className="w-full rounded border px-3 py-2 text-center text-lg tracking-widest"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "যাচাই হচ্ছে..." : "যাচাই করুন"}
      </button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<p>Loading...</p>}>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
