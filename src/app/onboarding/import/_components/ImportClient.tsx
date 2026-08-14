"use client";

import { useState, useTransition } from "react";
import { extractLandContractDocuments } from "../actions";
import NewContractWizard from "../../_components/NewContractWizard";
import type { ExtractedLandContract } from "@/server/landContractExtraction";

export default function ImportClient({ suggestedContractNumber }: { suggestedContractNumber: string }) {
  const [extracting, startExtracting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedLandContract | null>(null);

  function handleFiles(formData: FormData) {
    setError(null);
    startExtracting(async () => {
      const res = await extractLandContractDocuments(formData);
      if (res.error || !res.data) {
        setError(res.error ?? "Something went wrong reading the document(s).");
        return;
      }
      setExtracted(res.data);
    });
  }

  if (extracted) {
    return (
      <div>
        <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Pulled from your documents — fields highlighted in amber weren&apos;t found and need to be filled in by hand. Review everything
          else before clicking Create Contract.
        </p>
        <NewContractWizard suggestedContractNumber={suggestedContractNumber} initial={extracted} highlightMissing />
      </div>
    );
  }

  return (
    <form action={handleFiles} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="closingPackage">
          Closing Package (PDF)
        </label>
        <input
          id="closingPackage"
          name="closingPackage"
          type="file"
          accept="application/pdf"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="closingDisclosure">
          Closing Disclosure (PDF) — optional
        </label>
        <input
          id="closingDisclosure"
          name="closingDisclosure"
          type="file"
          accept="application/pdf"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={extracting}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {extracting ? "Reading documents..." : "Read Documents"}
      </button>
    </form>
  );
}
