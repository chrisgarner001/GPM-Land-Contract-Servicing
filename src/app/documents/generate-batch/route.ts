import { NextRequest, NextResponse } from "next/server";
import PizZip from "pizzip";
import { generateDeedDocx, buildDeedFilename, type DeedType } from "@/domain/documents/generateDeedDocx";
import { buildRenderData, applyContractPrefill, type Fields } from "@/domain/documents/buildRenderData";
import { getDeedPrefillData, logGeneratedDocument } from "@/server/documents";
import { createClient } from "@/lib/supabase/server";

const VALID_DEED_TYPES: DeedType[] = ["QCD", "WD", "WDS", "LC", "QCDLC", "LCA"];

// One or more contracts checked on the dashboard. Every contract gets its
// own document — Grantor/Seller and Buyer/property/LC-financial fields are
// resolved fresh per contract server-side (see applyContractPrefill); every
// other field comes from the shared `fields` the form sent, applied
// identically to each document (e.g. one Assignee receiving a batch of
// assignments). Returns a single .docx when exactly one contract was
// selected, or a .zip of all of them otherwise.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deedType, contractIds, fields } = body as {
    deedType: string;
    contractIds: string[];
    fields: Fields;
  };

  if (!VALID_DEED_TYPES.includes(deedType as DeedType)) {
    return NextResponse.json({ error: "Invalid deed type." }, { status: 400 });
  }
  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return NextResponse.json({ error: "Select at least one land contract." }, { status: 400 });
  }
  if (!fields || typeof fields !== "object") {
    return NextResponse.json({ error: "Missing field data." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const results: { filename: string; buffer: Buffer }[] = [];
  for (const contractId of contractIds) {
    const prefill = await getDeedPrefillData(contractId);
    if (!prefill) {
      return NextResponse.json({ error: `Contract not found: ${contractId}` }, { status: 400 });
    }

    const contractFields = applyContractPrefill(fields, prefill, deedType as DeedType);
    const renderData = buildRenderData(deedType as DeedType, contractFields);
    const grantorName = renderData.grantor_name || renderData.seller_name || null;
    const granteeName = renderData.grantee_name || renderData.assignee_name || null;
    const propertyAddress = renderData.street_address || renderData.property_address || null;

    let buffer: Buffer;
    try {
      buffer = generateDeedDocx(deedType as DeedType, renderData);
    } catch (e) {
      return NextResponse.json(
        { error: `Failed to generate document for ${prefill.contractNumber}: ${e instanceof Error ? e.message : "unknown error"}` },
        { status: 500 }
      );
    }

    await logGeneratedDocument({
      contractId,
      docType: deedType as DeedType,
      grantorName,
      granteeName,
      propertyAddress,
      dataSnapshot: JSON.stringify(renderData),
      generatedBy: user?.email ?? null,
    });

    results.push({ filename: buildDeedFilename(deedType as DeedType, grantorName, granteeName, prefill.contractNumber), buffer });
  }

  if (results.length === 1) {
    return new NextResponse(results[0].buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${results[0].filename}"`,
      },
    });
  }

  const zip = new PizZip();
  const usedNames = new Set<string>();
  for (const r of results) {
    let name = r.filename;
    let i = 2;
    while (usedNames.has(name)) {
      name = r.filename.replace(/\.docx$/, `-${i}.docx`);
      i++;
    }
    usedNames.add(name);
    zip.file(name, r.buffer);
  }
  const zipBuffer = zip.generate({ type: "nodebuffer" });
  const zipFilename = `${new Date().toISOString().slice(0, 10)}-${deedType}-batch-${results.length}.zip`;

  return new NextResponse(zipBuffer as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
    },
  });
}
