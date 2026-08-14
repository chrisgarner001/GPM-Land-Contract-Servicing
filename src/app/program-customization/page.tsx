import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSuperUser } from "@/lib/superUser";
import { listCustomizationRequests } from "@/server/customizationRequests";
import { formatDateTime } from "@/lib/format";

export default async function ProgramCustomizationPage() {
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

  const requests = await listCustomizationRequests();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Program Customization</h1>
          <p className="text-sm text-slate-500">
            Describe a customization in plain language — the agent drafts a Product Brief and Engineering Brief for a
            developer to review and implement. It never writes or deploys code itself.
          </p>
        </div>
        <Link href="/program-customization/new" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          + New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">No requests yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {requests.map((r) => (
            <Link key={r.id} href={`/program-customization/${r.id}`} prefetch={false} className="block px-4 py-3 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{r.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === "SUBMITTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.status === "SUBMITTED" ? "Submitted" : "Drafting"}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {r.taskType.replace("_", " ")} · {formatDateTime(r.createdAt)} · {r.requestedBy ?? "—"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
