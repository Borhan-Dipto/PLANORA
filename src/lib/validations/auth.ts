import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন"),
});

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().length(8, "কোডটি সঠিক নয়"),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
