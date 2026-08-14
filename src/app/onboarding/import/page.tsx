import Link from "next/link";
import { getNextContractNumber } from "@/server/onboarding";
import ImportClient from "./_components/ImportClient";

export default async function OnboardingImportPage() {
  const suggestedContractNumber = await getNextContractNumber();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/onboarding" className="text-sm font-medium text-blue-700 hover:underline">
        ← On Boarding
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900">Import Land Contract Information</h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload the Closing Package and Closing Disclosure for this land contract — the system reads them and pre-fills the same
        Borrower, Property, and Land Contract fields as manual entry. Nothing is saved until you review and confirm every field
        yourself and click Create Contract.
      </p>

      <ImportClient suggestedContractNumber={suggestedContractNumber} />
    </main>
  );
}
