import Link from "next/link";

export default function DistributionSheetPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/onboarding" className="text-sm font-medium text-blue-700 hover:underline">
        ← On Boarding
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Create Distribution Sheet</h1>
      <p className="mt-2 text-sm text-slate-500">Coming soon.</p>
    </main>
  );
}
