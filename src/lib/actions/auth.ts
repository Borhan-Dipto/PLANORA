"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, withDbRetry } from "@/db/client";
import { profiles } from "@/db/schema";
import { emailSchema, otpSchema, loginSchema, setPasswordSchema } from "@/lib/validations/auth";

type ActionResult = { error?: string; step?: "password"; email?: string };

/** Sends an 8-digit OTP to the given email. Creates the account on first use. Also used to
 * resend a code, and as the "recover with code" path when a returning user forgot their password. */
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

/** The /login form's single action. Step 1: email only — looks up whether this email already has
 * a password set. Known email + password set -> ask for the password right here (step 2); anything
 * else (new email, or a password never set) -> send an OTP code and move to /verify, same as before. */
export async function continueLogin(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  if (!password) {
    const [profile] = await withDbRetry(() =>
      db.select({ hasPassword: profiles.hasPassword }).from(profiles).where(eq(profiles.email, email)),
    );
    if (profile?.hasPassword) return { step: "password", email };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${process.env.APPLICATION_BASE_URL}/auth/confirm` },
    });
    if (error) return { error: "কোড পাঠানো যায়নি। আবার চেষ্টা করুন।" };
    redirect(`/verify?email=${encodeURIComponent(email)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { step: "password", email, error: "ইমেইল বা পাসওয়ার্ড ভুল।" };

  redirect("/dashboard");
}

/** Verifies the OTP and establishes a session. Always lands on /set-password next — this is the
 * only place a password gets (re)set, so it doubles as the "forgot password" recovery path too. */
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
    if (data.user) redirect("/set-password");
    return { error: "কোডটি ভুল বা মেয়াদ শেষ হয়ে গেছে।" };
  }

  redirect("/set-password");
}

/** /set-password form's action. Requires the session just established by verifyEmailOtp. */
export async function setNewPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "পাসওয়ার্ড সেট করা যায়নি। আবার চেষ্টা করুন।" };

  await withDbRetry(() => db.update(profiles).set({ hasPassword: true }).where(eq(profiles.id, userData.user.id)));

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
