import { Logomark } from "@/components/brand/logomark";

/** Route-level loading UI — Next.js shows this automatically while a page's server work is in
 * flight (navigations, slow data fetches). Branded instead of a generic spinner. */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-accent/20 [animation-duration:1.6s]" />
        <Logomark className="h-14 w-14 animate-[logo-pulse_1.6s_ease-in-out_infinite] drop-shadow-[0_8px_20px_rgba(224,160,57,0.35)]" />
      </div>
      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
      </div>
    </div>
  );
}
