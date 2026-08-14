import Link from "next/link";
import { FilePlus2 } from "lucide-react";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <FilePlus2 size={20} className="text-slate-400" aria-hidden="true" />
        On Boarding
      </h1>
      <p className="mt-2 mb-6 text-sm text-slate-500">Add a new land contract to the system.</p>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/onboarding/manual"
          className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Enter New Land Contract
        </Link>
        <Link
          href="/onboarding/import"
          className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Import Land Contract Information
        </Link>
        <Link
          href="/onboarding/distribution-sheet"
          className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Create Distribution Sheet
        </Link>
        <Link
          href="/onboarding/land-contract-package"
          className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Create Land Contract Package
        </Link>
      </div>
    </main>
  );
}
