"use server";

import { createClient } from "@/lib/supabase/server";
import { emailSchema, otpSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";

type ActionResult = { error?: string };

/** Sends an 8-digit OTP to the given email. Creates the account on first use. */
export async function sendEmailOtp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.APPLICATION_BASE_URL}/auth/confirm`,
    },
  });
  if (error) return { error: "কোড পাঠানো যায়নি। আবার চেষ্টা করুন।" };

  redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
}

/** Verifies the OTP and establishes a session. */
export async function verifyEmailOtp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = otpSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) {
    // Codes are single-use. If a slow network made the user resubmit (double-tap, or
    // the first request actually succeeded but the page didn't redirect in time), the
    // first call already consumed the code and logged them in — this second call then
    // fails with "invalid/expired" even though a real session exists. Check before
    // showing an error so a successful login never looks like a failure.
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
    return { error: "কোডটি ভুল বা মেয়াদ শেষ হয়ে গেছে।" };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
