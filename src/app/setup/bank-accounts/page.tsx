import Link from "next/link";
import { Building2 } from "lucide-react";
import { db } from "@/db/client";
import { bankAccounts } from "@/db/schema/setup";
import BankAccountsList from "./_components/BankAccountsList";
import AddBankAccountForm from "./_components/AddBankAccountForm";

export default async function SetupBankAccountsPage() {
  const rows = await db.select().from(bankAccounts).orderBy(bankAccounts.label);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/setup" className="text-sm font-medium text-blue-700 hover:underline">
        ← Setup
      </Link>
      <h1 className="mb-6 mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Building2 size={20} className="text-slate-400" aria-hidden="true" />
        Bank Accounts
      </h1>

      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <BankAccountsList rows={rows} />
      </div>

      <AddBankAccountForm />
    </main>
  );
}
