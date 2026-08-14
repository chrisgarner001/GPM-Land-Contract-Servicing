import Link from "next/link";
import { notFound } from "next/navigation";
import { getLandContractPackage } from "@/server/landContractPackages";
import { getCompanySettings } from "@/server/companySettings";
import { buildDefaultAnswers } from "@/domain/landContractPackage/answers";
import PackageForm from "./_components/PackageForm";

export default async function LandContractPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pkg, settings] = await Promise.all([getLandContractPackage(id), getCompanySettings()]);
  if (!pkg) notFound();

  // Company Settings fill the identity fields (Lender/preparer) a fresh
  // draft starts with; a package's own saved answers always win over them.
  const settingsDefaults = {
    lender_name: settings.companyName,
    lender_address: [settings.companyAddressLine1, [settings.companyCity, `${settings.companyState} ${settings.companyZip}`.trim()].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(", "),
    lender_nmls_id: settings.companyNmlsId ?? "",
    preparer_firm_name: settings.preparerFirmName,
    preparer_attorney_name: settings.preparerAttorneyName,
    preparer_address_line1: settings.preparerAddressLine1,
    preparer_city: settings.preparerCity,
    preparer_state: settings.preparerState,
    preparer_zip: settings.preparerZip,
    title_fee: settings.titleFeeCents !== null ? (settings.titleFeeCents / 100).toFixed(2) : "",
  };
  const answers = { ...buildDefaultAnswers(), ...settingsDefaults, ...(pkg.answers as Record<string, string>) };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/onboarding/land-contract-package" className="text-sm font-medium text-blue-700 hover:underline">
        ← Land Contract Packages
      </Link>
      <div className="mt-2 mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Create Land Contract Package</h1>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            pkg.status === "PUBLISHED"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-amber-50 text-amber-700 ring-amber-600/20"
          }`}
        >
          {pkg.status === "PUBLISHED" ? "Published" : "Draft"}
        </span>
      </div>

      {pkg.driveFolderUrl && (
        <p className="mb-4 text-sm text-slate-600">
          Published to{" "}
          <a href={pkg.driveFolderUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
            Google Drive
          </a>
          .
        </p>
      )}

      <PackageForm packageId={id} initialAnswers={answers} />
    </main>
  );
}
