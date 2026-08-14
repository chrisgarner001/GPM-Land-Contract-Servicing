import Link from "next/link";
import { notFound } from "next/navigation";
import { getContractDraft } from "@/server/contractDrafts";
import { getNextContractNumber } from "@/server/onboarding";
import { getExistingLenderOptions } from "@/server/funding";
import type { LandContractInitialValues } from "../../_components/NewContractWizard";
import NewContractWizard from "../../_components/NewContractWizard";

export default async function ContractDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getContractDraft(id);
  if (!draft) notFound();

  if (draft.status === "PUBLISHED") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link href="/onboarding/manual" className="text-sm font-medium text-blue-700 hover:underline">
          ← Enter New Land Contract
        </Link>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">This draft has already been used to create a contract.</h1>
          <p className="mb-4 text-sm text-slate-500">
            Creating a contract can&apos;t be undone or repeated from the same draft — to make changes, edit the contract directly.
          </p>
          {draft.publishedContractId && (
            <Link
              href={`/contracts/${draft.publishedContractId}`}
              className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              View Contract
            </Link>
          )}
        </div>
      </main>
    );
  }

  const [suggestedContractNumber, existingLenders] = await Promise.all([getNextContractNumber(), getExistingLenderOptions()]);
  const initial = draft.answers as LandContractInitialValues;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/onboarding/manual" className="text-sm font-medium text-blue-700 hover:underline">
        ← Enter New Land Contract
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900">Enter New Land Contract</h1>
      <p className="mb-6 text-sm text-slate-500">Walk through Borrower, Lender, Property, and Land Contract terms to add a new contract.</p>

      <NewContractWizard suggestedContractNumber={suggestedContractNumber} existingLenders={existingLenders} initial={initial} draftId={id} />
    </main>
  );
}
