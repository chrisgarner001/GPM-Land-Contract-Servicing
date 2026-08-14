import Link from "next/link";
import { Building } from "lucide-react";
import { getCompanySettings } from "@/server/companySettings";
import CompanySettingsForm from "./_components/CompanySettingsForm";

export default async function CompanySettingsPage() {
  const settings = await getCompanySettings();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/setup" className="text-sm font-medium text-blue-700 hover:underline">
        ← Setup
      </Link>
      <h1 className="mb-1 mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Building size={20} className="text-slate-400" aria-hidden="true" />
        Company Settings
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        This deployment&apos;s own business identity — used as the default Lender/preparer info on generated deeds and
        land contract packages, instead of being hardcoded per company.
      </p>

      <CompanySettingsForm settings={settings} />
    </main>
  );
}
