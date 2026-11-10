import "server-only";
import { cookies } from "next/headers";
import bn from "@/locales/bn.json";
import en from "@/locales/en.json";

export const locales = { bn, en } as const;
export type Locale = keyof typeof locales;
export type Dictionary = typeof bn;

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get("locale")?.value;
  return value === "en" ? "en" : "bn"; // bn is the default
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return locales[locale];
}
