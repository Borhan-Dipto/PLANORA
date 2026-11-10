import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <h1 className="text-5xl font-bold text-accent">PLANORA</h1>
      <p className="mt-3 text-lg text-muted">I Have a Real Plan.</p>
      <p className="mt-1 text-sm text-muted">Turn Goals Into Action.</p>
      <Link
        href="/login"
        className="mt-8 rounded-md bg-accent px-6 py-2.5 font-medium text-accent-foreground"
      >
        শুরু করুন
      </Link>
    </main>
  );
}
