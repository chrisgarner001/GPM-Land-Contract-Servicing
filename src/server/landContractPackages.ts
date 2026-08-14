import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { landContractPackages } from "@/db/schema/landContractPackages";
import { buildDefaultAnswers, type Answers } from "@/domain/landContractPackage/answers";
import { generateAllFiles } from "@/domain/landContractPackage/generatePackage";
import { uploadPackageToDrive } from "@/lib/googleDrive";

export interface PackageListRow {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  buyerName: string | null;
  propertyAddress: string | null;
  closingDate: string | null;
  driveFolderUrl: string | null;
  updatedAt: Date;
}

export async function listLandContractPackages(): Promise<PackageListRow[]> {
  return db
    .select({
      id: landContractPackages.id,
      status: landContractPackages.status,
      buyerName: landContractPackages.buyerName,
      propertyAddress: landContractPackages.propertyAddress,
      closingDate: landContractPackages.closingDate,
      driveFolderUrl: landContractPackages.driveFolderUrl,
      updatedAt: landContractPackages.updatedAt,
    })
    .from(landContractPackages)
    .orderBy(desc(landContractPackages.updatedAt));
}

export async function getLandContractPackage(id: string) {
  const [row] = await db.select().from(landContractPackages).where(eq(landContractPackages.id, id));
  return row ?? null;
}

export async function createLandContractPackage(createdBy: string | null): Promise<string> {
  const [row] = await db
    .insert(landContractPackages)
    .values({ answers: buildDefaultAnswers(), createdBy, updatedBy: createdBy })
    .returning({ id: landContractPackages.id });
  return row.id;
}

// Denormalizes the 3 list-page columns from `answers` on every save — see
// the schema file comment for why.
function summaryFields(answers: Answers) {
  const propertyAddress = [answers.property_street, answers.property_city, [answers.property_state, answers.property_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return {
    buyerName: answers.buyer_name || null,
    propertyAddress: propertyAddress || null,
    closingDate: answers.closing_date || null,
  };
}

export async function saveDraft(id: string, answers: Answers, updatedBy: string | null): Promise<void> {
  await db
    .update(landContractPackages)
    .set({ answers, ...summaryFields(answers), updatedBy, updatedAt: new Date() })
    .where(eq(landContractPackages.id, id));
}

export interface PublishResult {
  driveFolderUrl: string;
}

// Generates all 14 files and uploads them into a new (or de-duped) Drive
// folder, then marks the package PUBLISHED. Does not delete/roll back the
// draft on Drive failure — the answers are already saved either way, so a
// retry just re-runs generation and upload without losing data.
export async function publishPackage(id: string, answers: Answers, updatedBy: string | null): Promise<PublishResult> {
  await saveDraft(id, answers, updatedBy);

  const files = await generateAllFiles(answers);
  const closingDateSlug = answers.closing_date ? answers.closing_date.replace(/-/g, "-") : "";
  const folderName = [answers.buyer_name, summaryFields(answers).propertyAddress, "closing docs", closingDateSlug]
    .filter(Boolean)
    .join(", ");

  const { folderUrl } = await uploadPackageToDrive(folderName, files);

  await db
    .update(landContractPackages)
    .set({ status: "PUBLISHED", driveFolderUrl: folderUrl, publishedAt: new Date(), updatedBy, updatedAt: new Date() })
    .where(eq(landContractPackages.id, id));

  return { driveFolderUrl: folderUrl };
}
