import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getNameAddressListing } from "@/server/borrowerReports";
import { emailNameAddressListingAction } from "./actions";

export default async function BorrowerNameAddressListingPage() {
  const rows = await getNameAddressListing();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/reports/borrower" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Borrower Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Name &amp; Address Listing</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">Borrower name and mailing address list.</p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      {/* No Post to Borrower Portal here — this is every borrower's contact
          info in one list, and posting it would leak everyone's data into
          one borrower's own portal. */}
      <ReportActionBar excelHref="/reports/borrower/name-address-listing/export" onEmail={emailNameAddressListingAction} />

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Land Contract</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Mailing Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No borrowers on file.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">{r.contractNumber}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.displayName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[r.mailingAddressLine1, r.mailingCity, r.mailingState, r.mailingZip].filter(Boolean).join(", ") || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
