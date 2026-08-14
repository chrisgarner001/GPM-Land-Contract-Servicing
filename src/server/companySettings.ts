import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { companySettings } from "@/db/schema/setup";

export type CompanySettings = typeof companySettings.$inferSelect;

// Single-row table — every deployment has exactly one company identity.
// The row is seeded by migration 0052, so this should always find one.
export async function getCompanySettings(): Promise<CompanySettings> {
  const [row] = await db.select().from(companySettings).limit(1);
  if (!row) throw new Error("company_settings has no row — migration 0052 should have seeded one.");
  return row;
}

export interface UpdateCompanySettingsInput {
  companyName: string;
  companyAddressLine1: string;
  companyCity: string;
  companyState: string;
  companyZip: string;
  companyNmlsId: string | null;
  preparerFirmName: string;
  preparerAttorneyName: string;
  preparerAddressLine1: string;
  preparerCity: string;
  preparerState: string;
  preparerZip: string;
  titleFeeCents: number | null;
  defaultContactName: string;
  defaultContactAddressLine1: string;
  defaultContactCity: string;
  defaultContactState: string;
  defaultContactZip: string;
  defaultNotaryState: string;
}

export async function updateCompanySettings(id: string, input: UpdateCompanySettingsInput): Promise<void> {
  await db
    .update(companySettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(companySettings.id, id));
}
