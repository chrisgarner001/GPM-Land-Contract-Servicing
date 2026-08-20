import Link from "next/link";
import { FileSignature } from "lucide-react";
import { listLandContractPackages } from "@/server/landContractPackages";
import { formatDateTime } from "@/lib/format";
import { createPackageAction } from "./actions";
import DeletePackageButton from "./_components/DeletePackageButton";

export default async function LandContractPackageListPage() {
  const packages = await listLandContractPackages();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/onboarding" className="text-sm font-medium text-blue-700 hover:underline">
        ← Onboarding
      </Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <FileSignature size={20} className="text-slate-400" aria-hidden="true" />
            Create Land Contract Package
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Draft, save, and publish a new closing package — signed by all parties before the contract is onboarded.
          </p>
        </div>
        <form action={createPackageAction}>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            New Package
          </button>
        </form>
      </div>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No packages started yet — click New Package to begin one.
                </td>
              </tr>
            ) : (
              packages.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/onboarding/land-contract-package/${p.id}`} className="font-medium text-blue-700 hover:underline">
                      {p.buyerName || "(unnamed buyer)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.propertyAddress || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        p.status === "PUBLISHED"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-amber-50 text-amber-700 ring-amber-600/20"
                      }`}
                    >
                      {p.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDateTime(p.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">{p.status === "DRAFT" && <DeletePackageButton packageId={p.id} />}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
