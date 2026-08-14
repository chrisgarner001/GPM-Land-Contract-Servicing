import Link from "next/link";
import { listContractDrafts, type ContractDraftListRow } from "@/server/contractDrafts";
import { formatDateTime } from "@/lib/format";
import { createDraftAction } from "./actions";
import DeleteDraftButton from "./_components/DeleteDraftButton";

function borrowerLabel(d: ContractDraftListRow): string {
  return d.borrowerName || "(unnamed borrower)";
}

export default async function OnboardingManualPage() {
  const drafts = await listContractDrafts();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/onboarding" className="text-sm font-medium text-blue-700 hover:underline">
        ← On Boarding
      </Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Enter New Land Contract</h1>
          <p className="mt-1 text-sm text-slate-500">
            Walk through Borrower, Lender, Property, and Land Contract terms — save your progress anytime and come back later.
          </p>
        </div>
        <form action={createDraftAction}>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            New Contract
          </button>
        </form>
      </div>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Borrower</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No contracts started yet — click New Contract to begin one.
                </td>
              </tr>
            ) : (
              drafts.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/onboarding/manual/${d.id}`} className="font-medium text-blue-700 hover:underline">
                      {borrowerLabel(d)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.propertyAddress || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        d.status === "PUBLISHED"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20"
                      }`}
                    >
                      {d.status === "PUBLISHED" ? "Created" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDateTime(d.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">{d.status === "DRAFT" && <DeleteDraftButton draftId={d.id} />}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
