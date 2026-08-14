import { FileSpreadsheet } from "lucide-react";

export default function TaxBillProcessingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
        <FileSpreadsheet size={20} className="text-slate-400" aria-hidden="true" />
        Tax Bill Processing
      </h1>
      <p className="mt-2 text-sm text-slate-500">Coming soon.</p>
    </main>
  );
}
