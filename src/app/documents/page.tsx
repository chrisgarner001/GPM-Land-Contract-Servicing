import { FileSignature } from "lucide-react";
import { getContractOptionsForDocuments } from "@/server/documents";
import { getCompanySettings } from "@/server/companySettings";
import DocumentDashboardForm from "./_components/DocumentDashboardForm";

export default async function DocumentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string }>;
}) {
  const { contractId } = await searchParams;
  const [contractOptions, settings] = await Promise.all([getContractOptionsForDocuments(), getCompanySettings()]);
  const companyDefaults = {
    contactName: settings.defaultContactName,
    contactAddress: settings.defaultContactAddressLine1,
    contactCsz: [settings.defaultContactCity, `${settings.defaultContactState} ${settings.defaultContactZip}`.trim()]
      .filter(Boolean)
      .join(", "),
    notaryState: settings.defaultNotaryState,
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <FileSignature size={20} className="text-slate-400" aria-hidden="true" />
        Deed Dashboard
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Generate Michigan deeds and land contract assignments as .docx files — check one or more active land
        contracts to auto-fill Seller/Grantor, Buyer, and property details, or leave everything unchecked to fill in
        a document by hand.
      </p>

      <DocumentDashboardForm
        contractOptions={contractOptions}
        initialSelectedContractId={contractId ?? null}
        companyDefaults={companyDefaults}
      />
    </main>
  );
}
