import Link from "next/link";
import CategoryTabs from "../../../_components/CategoryTabs";
import ReportActionBar from "../../_components/ReportActionBar";
import { getVendorNameAddressListing } from "@/server/vendorReports";
import { emailVendorNameAddressListingAction } from "./actions";

export default async function VendorNameAddressListingPage() {
  const rows = await getVendorNameAddressListing();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/reports/vendor" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Vendor Reports
      </Link>
      <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900 print:hidden">Name &amp; Address Listing</h1>
      <p className="mb-4 text-sm text-slate-500 print:hidden">Vendor name and mailing address list.</p>
      <div className="print:hidden">
        <CategoryTabs basePath="/reports" />
      </div>

      {/* No Post to Portal here — vendors don't have one, and this is every
          vendor's contact info at once regardless. */}
      <ReportActionBar excelHref="/reports/vendor/name-address-listing/export" onEmail={emailVendorNameAddressListingAction} />

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Account Code</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Mailing Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No vendors on file.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.displayName}</td>
                  <td className="px-4 py-3 text-slate-500">{r.vendorAccountCode}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{[r.addressLine1, r.cityStateZip].filter(Boolean).join(", ") || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
