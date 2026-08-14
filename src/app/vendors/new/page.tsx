import Link from "next/link";
import { UserPlus } from "lucide-react";
import { db } from "@/db/client";
import { glCodes } from "@/db/schema/setup";
import AddVendorForm from "./_components/AddVendorForm";

export default async function AddVendorPage() {
  const glCodeOptions = await db
    .select({ code: glCodes.code, description: glCodes.description, type: glCodes.type })
    .from(glCodes)
    .orderBy(glCodes.code);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/vendors" className="text-sm font-medium text-blue-700 hover:underline">
        ← All Vendors
      </Link>
      <h1 className="mb-6 mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <UserPlus size={20} className="text-slate-400" aria-hidden="true" />
        Add New Vendor
      </h1>

      <AddVendorForm glCodeOptions={glCodeOptions} />
    </main>
  );
}
