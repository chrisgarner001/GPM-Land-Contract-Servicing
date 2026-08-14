"use client";

import { useState } from "react";
import { formatDate, formatDateTime } from "@/lib/format";

export interface PostedDocument {
  id: string;
  documentType: string;
  rangeStart: string;
  rangeEnd: string;
  contentHtml: string;
  postedAt: Date;
}

// Shared by the Borrower and Lender portals — each passes its own
// documentType -> label map (the two sets of report types don't overlap).
export default function PostedDocumentsSection({ documents, labels }: { documents: PostedDocument[]; labels: Record<string, string> }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (documents.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Statements &amp; Documents</h3>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {documents.map((doc) => (
          <div key={doc.id}>
            <button
              type="button"
              onClick={() => setOpenId(openId === doc.id ? null : doc.id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{labels[doc.documentType] ?? doc.documentType}</p>
                <p className="text-sm text-slate-500">
                  {doc.rangeStart === doc.rangeEnd ? formatDate(doc.rangeStart) : `${formatDate(doc.rangeStart)} – ${formatDate(doc.rangeEnd)}`} ·
                  Posted {formatDateTime(doc.postedAt)}
                </p>
              </div>
              <span className="text-sm text-blue-700">{openId === doc.id ? "Hide" : "View"}</span>
            </button>
            {openId === doc.id && (
              <div className="overflow-x-auto border-t border-slate-100 bg-slate-50 px-4 py-4">
                {/* Server-generated content (our own report-render functions),
                    not raw borrower/lender/user input — safe to render directly. */}
                <div dangerouslySetInnerHTML={{ __html: doc.contentHtml }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
