import Link from "next/link";
import { getNextContractNumber } from "@/server/onboarding";
import { getExistingLenderOptions } from "@/server/funding";
import NewContractWizard from "../_components/NewContractWizard";

export default async function OnboardingManualPage() {
  const [suggestedContractNumber, existingLenders] = await Promise.all([getNextContractNumber(), getExistingLenderOptions()]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/onboarding" className="text-sm font-medium text-blue-700 hover:underline">
        ← On Boarding
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900">Enter New Land Contract</h1>
      <p className="mb-6 text-sm text-slate-500">Walk through Borrower, Lender, Property, and Land Contract terms to add a new contract.</p>

      <NewContractWizard suggestedContractNumber={suggestedContractNumber} existingLenders={existingLenders} />
    </main>
  );
}
