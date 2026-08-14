import Link from "next/link";
import { UserCog } from "lucide-react";
import { db } from "@/db/client";
import { staffUsers } from "@/db/schema/setup";
import AddStaffUserForm from "./_components/AddStaffUserForm";
import InviteButton from "./_components/InviteButton";

export default async function SetupUsersPage() {
  const rows = await db.select().from(staffUsers).orderBy(staffUsers.name);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/setup" className="text-sm font-medium text-blue-700 hover:underline">
        ← Setup
      </Link>
      <h1 className="mb-6 mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <UserCog size={20} className="text-slate-400" aria-hidden="true" />
        Users
      </h1>

      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                  No users on record yet.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.role === "ADMIN" ? "Admin" : "Staff"}</td>
                  <td className="px-4 py-3">
                    <InviteButton email={u.email} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddStaffUserForm />
    </main>
  );
}
