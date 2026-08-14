import Link from "next/link";

interface CoBorrowerRow {
  partyId: string;
  displayName: string;
  role: string;
  contractNumber: string;
}

export default function CoBorrowersSection({ coBorrowers }: { coBorrowers: CoBorrowerRow[] }) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Co-Borrowers / Other Parties</h3>
      {coBorrowers.length === 0 ? (
        <p className="text-sm text-slate-400">No other parties on this borrower&apos;s land contracts.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Land Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coBorrowers.map((c, i) => (
                <tr key={`${c.partyId}-${c.contractNumber}-${i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/borrowers/${c.partyId}`} prefetch={false} className="font-medium text-blue-700 hover:underline">
                      {c.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.role === "CO_BUYER" ? "Co-Buyer" : "Buyer"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.contractNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
