import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
});

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().length(6, "৬ সংখ্যার কোড দিন"),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
