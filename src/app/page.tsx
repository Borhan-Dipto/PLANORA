import Link from "next/link";
import { Logomark } from "@/components/brand/logomark";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <Logomark className="mb-5 h-16 w-16 drop-shadow-[0_6px_16px_rgba(37,99,235,0.45)]" />
      <h1 className="font-brand text-5xl font-bold tracking-tight text-foreground">PLANORA</h1>
      <p className="mt-3 text-lg text-muted">I Have a Real Plan.</p>
      <p className="mt-1 text-sm text-muted">Turn Goals Into Action.</p>
      <Link
        href="/login"
        className="mt-8 rounded-lg bg-accent px-6 py-2.5 font-medium text-accent-foreground shadow-sm shadow-accent/30 hover:opacity-90"
      >
        শুরু করুন
      </Link>
    </main>
  );
}
