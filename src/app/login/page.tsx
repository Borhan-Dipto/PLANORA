"use client";

import { useActionState } from "react";
import { sendEmailOtp } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendEmailOtp, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">PLANORA</h1>
        <p className="text-sm text-gray-500">আপনার ইমেইল দিন, আমরা একটা কোড পাঠাব।</p>
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full rounded border px-3 py-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "পাঠানো হচ্ছে..." : "কোড পাঠান"}
        </button>
      </form>
    </main>
  );
}
