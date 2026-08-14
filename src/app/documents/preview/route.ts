import { NextRequest, NextResponse } from "next/server";
import type { DeedType } from "@/domain/documents/generateDeedDocx";
import { applyContractPrefill, buildDefaultFields, getPerContractKeys } from "@/domain/documents/buildRenderData";
import { getDeedPrefillData } from "@/server/documents";

const VALID_DEED_TYPES: DeedType[] = ["QCD", "WD", "WDS", "LC", "QCDLC", "LCA"];

export interface ContractPreview {
  contractId: string;
  contractNumber: string;
  grantorName: string;
  grantorAddress: string;
  // Only present when this deed type resolves Grantee/Assignee per-contract
  // (WD/WDS, from the buyer) — omitted otherwise, since for every other
  // type the grantee is a shared value typed once in the form, not
  // something this contract's own data determines.
  granteeName?: string;
  buyerName: string;
  county: string;
  streetAddress: string;
  parcelIds: string;
  legalDescription: string;
  salePrice?: string;
  missingFields: string[];
}

// Read-only — no document generated, nothing logged. Lets staff see exactly
// what a batch (or single) generation would resolve per contract before
// committing to it, since generate-batch's per-contract fields are never
// shown/editable in the form itself once a contract is checked.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { deedType, contractIds } = body as { deedType: string; contractIds: string[] };

  if (!VALID_DEED_TYPES.includes(deedType as DeedType)) {
    return NextResponse.json({ error: "Invalid deed type." }, { status: 400 });
  }
  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return NextResponse.json({ error: "Select at least one land contract." }, { status: 400 });
  }

  const perContractKeys = getPerContractKeys(deedType as DeedType);
  const emptyFields = buildDefaultFields();

  const previews: ContractPreview[] = [];
  for (const contractId of contractIds) {
    const prefill = await getDeedPrefillData(contractId);
    if (!prefill) {
      return NextResponse.json({ error: `Contract not found: ${contractId}` }, { status: 400 });
    }

    const merged = applyContractPrefill(emptyFields, prefill, deedType as DeedType);
    const missingFields = perContractKeys.filter((key) => !merged[key]?.trim()).map((k) => k.replace(/_/g, " "));

    previews.push({
      contractId,
      contractNumber: prefill.contractNumber,
      grantorName: merged.grantor_name,
      grantorAddress: merged.grantor_address,
      ...(deedType === "WD" || deedType === "WDS" ? { granteeName: merged.grantee_name } : {}),
      buyerName: merged.buyer_name,
      county: merged.county,
      streetAddress: merged.street_address,
      parcelIds: merged.parcel_ids,
      legalDescription: merged.legal_description,
      ...(deedType === "WDS" ? { salePrice: merged.sale_price } : {}),
      missingFields,
    });
  }

  return NextResponse.json({ previews });
}
