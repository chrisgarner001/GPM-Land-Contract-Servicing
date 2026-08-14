import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSuperUser } from "@/lib/superUser";
import { getCustomizationRequest } from "@/server/customizationRequests";
import { formatDateTime } from "@/lib/format";
import CopyBriefButton from "./_components/CopyBriefButton";

export default async function CustomizationRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await isSuperUser(user?.email))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-slate-500">Not authorized.</p>
      </main>
    );
  }

  const request = await getCustomizationRequest(id);
  if (!request) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-slate-500">Request not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/program-customization" className="text-sm font-medium text-blue-700 hover:underline">
        ← Program Customization
      </Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{request.title}</h1>
          <p className="text-sm text-slate-500">
            {request.taskType.replace("_", " ")} · {formatDateTime(request.createdAt)} · {request.requestedBy ?? "—"}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            request.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {request.status === "SUBMITTED" ? "Submitted" : "Drafting"}
        </span>
      </div>

      <p className="mb-6 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
        This is documentation only — no code has been changed. Copy a brief below into{" "}
        <code className="rounded bg-slate-100 px-1">tasks/&#123;task-name&#125;/</code> to hand it to a real Claude Code
        session for implementation.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Product Brief</h2>
            <CopyBriefButton text={request.productBriefMarkdown ?? ""} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{request.productBriefMarkdown}</pre>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Engineering Brief</h2>
            <CopyBriefButton text={request.engineeringBriefMarkdown ?? ""} />
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{request.engineeringBriefMarkdown}</pre>
        </div>
      </div>
    </main>
  );
}
