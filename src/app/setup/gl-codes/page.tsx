import Link from "next/link";
import { Hash } from "lucide-react";
import { db } from "@/db/client";
import { glCodes } from "@/db/schema/setup";
import AddGlCodeForm from "./_components/AddGlCodeForm";
import PrintButton from "./_components/PrintButton";
import { GL_CODE_TYPE_LABELS } from "./glCodeTypeLabels";

export default async function SetupGlCodesPage() {
  const rows = await db.select().from(glCodes).orderBy(glCodes.code);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/setup" className="text-sm font-medium text-blue-700 hover:underline print:hidden">
        ← Setup
      </Link>
      <div className="mb-6 mt-2 flex items-center justify-between print:mb-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Hash size={20} className="text-slate-400" aria-hidden="true" />
          Chart of Accounts / GL Codes
        </h1>
        <div className="flex items-center gap-2 print:hidden">
          <PrintButton />
          <a
            href="/setup/gl-codes/export"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download Excel
          </a>
        </div>
      </div>

      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 print:bg-transparent">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                  No GL codes on record yet.
                </td>
              </tr>
            ) : (
              rows.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{g.code}</td>
                  <td className="px-4 py-3 text-slate-600">{g.description ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{g.type ? GL_CODE_TYPE_LABELS[g.type] : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="print:hidden">
        <AddGlCodeForm />
      </div>
    </main>
  );
}
