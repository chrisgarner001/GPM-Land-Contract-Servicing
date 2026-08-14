import { ScanLine } from "lucide-react";
import { getActiveContractOptions } from "./actions";
import BulkPaymentClient from "./_components/BulkPaymentClient";

export default async function BulkPaymentPage() {
  const contractOptions = await getActiveContractOptions();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <ScanLine size={20} className="text-slate-400" aria-hidden="true" />
        Bulk Payment
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Upload scanned check images. Each check&apos;s payer and amount are read automatically and matched to a land
        contract — review and correct before recording.
      </p>
      <BulkPaymentClient contractOptions={contractOptions} />
    </main>
  );
}
