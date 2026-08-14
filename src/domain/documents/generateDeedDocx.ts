import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type DeedType = "QCD" | "WD" | "WDS" | "LC" | "QCDLC" | "LCA";

// Filenames are literal (not derived from user input) so Next.js's build-time
// file tracing can find and bundle them into the deployed function alongside
// this module — see next.config.ts's outputFileTracingIncludes.
const TEMPLATE_FILENAMES: Record<DeedType, string> = {
  QCD: "QCD_template_tagged.docx",
  WD: "WD_template_tagged.docx",
  WDS: "WDS_template_tagged.docx",
  LC: "LCICD_template_tagged.docx",
  QCDLC: "QCDLC_template_fixed.docx",
  LCA: "LCA_template_tagged.docx",
};

// QCDLC's template is tagged with {{double braces}} — everything else uses
// docxtemplater's default {single braces} — ported from the standalone
// dashboard's generateDeed(), which branches the same way.
const QCDLC_DELIMITERS = { start: "{{", end: "}}" };

export function generateDeedDocx(deedType: DeedType, data: Record<string, string>): Buffer {
  const templatePath = path.join(process.cwd(), "src", "document-templates", TEMPLATE_FILENAMES[deedType]);
  const zip = new PizZip(fs.readFileSync(templatePath));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    ...(deedType === "QCDLC" ? { delimiters: QCDLC_DELIMITERS } : {}),
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" });
}

function slug(value: string | null | undefined, fallback: string): string {
  return (value || fallback).replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 30).replace(/^-|-$/g, "");
}

export function buildDeedFilename(
  deedType: DeedType,
  grantorName: string | null,
  granteeName: string | null,
  contractNumber?: string | null
): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = contractNumber ? `-${slug(contractNumber, "")}` : "";
  return `${date}-${deedType}-${slug(grantorName, "Grantor")}-to-${slug(granteeName, "Grantee")}${suffix}.docx`;
}
