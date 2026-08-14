import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { contractOnboardingDrafts } from "@/db/schema/contractOnboardingDrafts";

export type ContractDraftAnswers = Record<string, string>;

export interface ContractDraftListRow {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  borrowerName: string | null;
  propertyAddress: string | null;
  publishedContractId: string | null;
  updatedAt: Date;
}

export async function listContractDrafts(): Promise<ContractDraftListRow[]> {
  return db
    .select({
      id: contractOnboardingDrafts.id,
      status: contractOnboardingDrafts.status,
      borrowerName: contractOnboardingDrafts.borrowerName,
      propertyAddress: contractOnboardingDrafts.propertyAddress,
      publishedContractId: contractOnboardingDrafts.publishedContractId,
      updatedAt: contractOnboardingDrafts.updatedAt,
    })
    .from(contractOnboardingDrafts)
    .orderBy(desc(contractOnboardingDrafts.updatedAt));
}

export async function getContractDraft(id: string) {
  const [row] = await db.select().from(contractOnboardingDrafts).where(eq(contractOnboardingDrafts.id, id));
  return row ?? null;
}

export async function createContractDraft(createdBy: string | null): Promise<string> {
  const [row] = await db
    .insert(contractOnboardingDrafts)
    .values({ answers: {}, createdBy, updatedBy: createdBy })
    .returning({ id: contractOnboardingDrafts.id });
  return row.id;
}

// Denormalizes the 2 list-page columns from `answers` on every save — see
// the schema file comment for why.
function summaryFields(answers: ContractDraftAnswers) {
  const borrowerName =
    answers.borrowerPartyType === "BUSINESS"
      ? answers.borrowerCompanyName
      : [answers.borrowerFirstName, answers.borrowerLastName].filter(Boolean).join(" ");
  const propertyAddress = [answers.streetAddress, answers.city, [answers.state, answers.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return {
    borrowerName: borrowerName || null,
    propertyAddress: propertyAddress || null,
  };
}

export async function saveContractDraft(id: string, answers: ContractDraftAnswers, updatedBy: string | null): Promise<void> {
  await db
    .update(contractOnboardingDrafts)
    .set({ answers, ...summaryFields(answers), updatedBy, updatedAt: new Date() })
    .where(eq(contractOnboardingDrafts.id, id));
}

// Only ever called for a DRAFT row — a PUBLISHED one already became a real
// contract and must be removed (if at all) via that contract's own Cancel/
// Delete in its Danger Zone, not from here.
export async function deleteContractDraft(id: string): Promise<void> {
  await db.delete(contractOnboardingDrafts).where(eq(contractOnboardingDrafts.id, id));
}
