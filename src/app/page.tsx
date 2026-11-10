import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold">PLANORA</h1>
      <p className="mt-2 text-gray-500">I Have a Real Plan.</p>
      <Link href="/login" className="mt-6 rounded bg-blue-600 px-4 py-2 text-white">
        শুরু করুন
      </Link>
    </main>
  );
}
