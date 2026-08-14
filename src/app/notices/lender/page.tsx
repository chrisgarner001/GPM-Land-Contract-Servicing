import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Landmark } from "lucide-react";
import { db } from "@/db/client";
import { noticeTemplates } from "@/db/schema/notices";
import { formatDateTime } from "@/lib/format";
import CategoryTabs from "../../_components/CategoryTabs";
import { NOTICES_TAB_CATEGORIES } from "../_categories";

export default async function LenderNoticesPage() {
  const templates = await db
    .select()
    .from(noticeTemplates)
    .where(eq(noticeTemplates.category, "LENDER"))
    .orderBy(desc(noticeTemplates.createdAt));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <Landmark size={20} className="text-slate-400" aria-hidden="true" />
        Notices
      </h1>
      <p className="mb-4 text-sm text-slate-500">Lender notices.</p>
      <CategoryTabs basePath="/notices" categories={NOTICES_TAB_CATEGORIES} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Custom Templates</h2>
        <Link href="/notices/template-builder" className="text-sm font-medium text-blue-700 hover:underline">
          + New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-slate-400">No lender templates yet — build one in Template Builder.</p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">
                  {t.channel === "EMAIL" ? "Email" : "Letter"} · Created {formatDateTime(t.createdAt)}
                </p>
              </div>
              <Link
                href={`/notices/lender/send/${t.id}`}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Send
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
