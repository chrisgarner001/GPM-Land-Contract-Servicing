import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { noticeTemplates } from "@/db/schema/notices";
import { getRecipientOptions } from "@/server/notices";
import SendNoticeClient from "../../../_components/SendNoticeClient";

export default async function SendBorrowerNoticePage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const [template] = await db.select().from(noticeTemplates).where(eq(noticeTemplates.id, templateId));

  if (!template || template.category !== "BORROWER") {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-slate-500">Template not found.</p>
      </main>
    );
  }

  const recipients = await getRecipientOptions("BORROWER");

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="print:hidden">
        <Link href="/notices/borrower" className="text-sm font-medium text-blue-700 hover:underline">
          ← Borrower Notices
        </Link>
        <h1 className="mt-2 mb-1 text-xl font-semibold text-slate-900">{template.name}</h1>
        <p className="mb-6 text-sm text-slate-500">{template.channel === "EMAIL" ? "Email" : "Letter"} notice — pick a borrower to send to.</p>
      </div>

      <SendNoticeClient
        templateId={template.id}
        category="BORROWER"
        channel={template.channel}
        recipients={recipients}
        minDaysPastDue={template.minDaysPastDue}
      />
    </main>
  );
}
