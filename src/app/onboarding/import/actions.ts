"use server";

import { extractLandContractData, type ExtractedLandContract, type SourceDocument } from "@/server/landContractExtraction";

export interface ExtractLandContractState {
  error?: string;
  data?: ExtractedLandContract;
}

// Two named file inputs (not a generic multi-file picker like Bulk
// Payment's) since these are two distinct, specific document types, not N
// of the same thing. Closing Package is required; Closing Disclosure is
// optional since not every land contract deal produces one.
export async function extractLandContractDocuments(formData: FormData): Promise<ExtractLandContractState> {
  const closingPackage = formData.get("closingPackage");
  const closingDisclosure = formData.get("closingDisclosure");

  if (!(closingPackage instanceof File) || closingPackage.size === 0) {
    return { error: "Select the Closing Package PDF." };
  }

  try {
    const documents: SourceDocument[] = [
      { base64: Buffer.from(await closingPackage.arrayBuffer()).toString("base64"), label: "Closing Package" },
    ];
    if (closingDisclosure instanceof File && closingDisclosure.size > 0) {
      documents.push({ base64: Buffer.from(await closingDisclosure.arrayBuffer()).toString("base64"), label: "Closing Disclosure" as const });
    }

    const data = await extractLandContractData(documents);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to read the document(s). Try again, or enter this contract manually." };
  }
}
