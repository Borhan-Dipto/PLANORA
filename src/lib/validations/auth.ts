import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
});

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().length(8, "কোডটি সঠিক নয়"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
  password: z.string().optional(),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "দুটি পাসওয়ার্ড মিলছে না।", path: ["confirm"] });

export type EmailInput = z.infer<typeof emailSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
