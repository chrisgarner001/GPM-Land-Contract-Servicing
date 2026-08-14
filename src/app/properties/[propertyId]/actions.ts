"use server";

import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { properties, propertyTypeEnum } from "@/db/schema/parties";
import { propertyAssessorSnapshots } from "@/db/schema/assessorSearch";
import { lookupPropertyByAddress, lookupPropertyById } from "@/lib/assessorSearch";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

export interface UpdatePropertyState {
  error?: string;
  success?: string;
}

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export async function updatePropertyAction(
  propertyId: string,
  _prevState: UpdatePropertyState | undefined,
  formData: FormData
): Promise<UpdatePropertyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const streetAddress = trimmedOrNull(formData.get("streetAddress"));
  const city = trimmedOrNull(formData.get("city"));
  const state = trimmedOrNull(formData.get("state"));
  const zip = trimmedOrNull(formData.get("zip"));
  const county = trimmedOrNull(formData.get("county"));
  if (!streetAddress || !city || !state || !zip || !county) {
    return { error: "Street Address, City, State, Zip, and County are all required." };
  }

  const propertyTypeRaw = formData.get("propertyType");
  const propertyType = propertyTypeEnum.enumValues.includes(propertyTypeRaw as (typeof propertyTypeEnum.enumValues)[number])
    ? (propertyTypeRaw as (typeof propertyTypeEnum.enumValues)[number])
    : null;

  await db
    .update(properties)
    .set({
      streetAddress,
      city,
      state,
      zip,
      county,
      parcelNumber: trimmedOrNull(formData.get("parcelNumber")),
      propertyType,
      insuranceCarrierVendorId: trimmedOrNull(formData.get("insuranceCarrierVendorId")),
      insuranceLastBillAmountCents: dollarsToCents(formData.get("insuranceLastBillAmount")),
      insuranceLastBillDate: trimmedOrNull(formData.get("insuranceLastBillDate")),
      winterTaxLastBillAmountCents: dollarsToCents(formData.get("winterTaxLastBillAmount")),
      winterTaxLastBillDate: trimmedOrNull(formData.get("winterTaxLastBillDate")),
      summerTaxLastBillAmountCents: dollarsToCents(formData.get("summerTaxLastBillAmount")),
      summerTaxLastBillDate: trimmedOrNull(formData.get("summerTaxLastBillDate")),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId));

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
  return { success: "Property updated." };
}

export interface RefreshAssessorDataState {
  error?: string;
  success?: string;
}

// Staff-triggered only — never called automatically, since every match
// costs a real, billed AssessorSearch credit. Refreshes by AssessorSearch's
// own property_id when a prior snapshot has one (more precise, and immune
// to the address text drifting from whatever originally matched);
// otherwise resolves fresh by the property's own address.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function refreshAssessorData(
  propertyId: string,
  _prevState: RefreshAssessorDataState | undefined,
  _formData: FormData
): Promise<RefreshAssessorDataState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    await requireEditAccess(user?.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId));
  if (!property) return { error: "Property not found." };

  const [latest] = await db
    .select({ assessorPropertyId: propertyAssessorSnapshots.assessorPropertyId })
    .from(propertyAssessorSnapshots)
    .where(eq(propertyAssessorSnapshots.propertyId, propertyId))
    .orderBy(desc(propertyAssessorSnapshots.fetchedAt))
    .limit(1);

  let record;
  try {
    record = latest?.assessorPropertyId
      ? await lookupPropertyById(latest.assessorPropertyId)
      : await lookupPropertyByAddress(`${property.streetAddress}, ${property.city}, ${property.state} ${property.zip}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AssessorSearch lookup failed." };
  }

  if (!record) {
    return { error: "No AssessorSearch match found for this address." };
  }

  await db.insert(propertyAssessorSnapshots).values({
    propertyId,
    assessorPropertyId: record.assessorPropertyId,
    apn: record.apn,
    county: record.county,
    ownerFullName: record.ownerFullName,
    assessedValueCents: record.assessedValueCents,
    totalMarketValueCents: record.totalMarketValueCents,
    estimatedMarketValueCents: record.estimatedMarketValueCents,
    annualTaxAmountCents: record.annualTaxAmountCents,
    taxYear: record.taxYear,
    isTaxExemption: record.isTaxExemption,
    exemptionType: record.exemptionType,
    delinquentYear: record.delinquentYear,
    lastSaleDate: record.lastSaleDate,
    lastSaleAmountCents: record.lastSaleAmountCents,
    isListed: record.isListed,
    isListedDate: record.isListedDate,
    isPreForeclosure: record.isPreForeclosure,
    yearBuilt: record.yearBuilt,
    beds: record.beds,
    baths: record.baths !== null ? String(record.baths) : null,
    sqft: record.sqft,
    lotSizeSqft: record.lotSizeSqft,
    legalDescription: record.legalDescription,
    combinedEstimatedLoanBalanceCents: record.combinedEstimatedLoanBalanceCents,
    estimatedEquityCents: record.estimatedEquityCents,
    rawResponse: record.raw,
  });

  // AssessorSearch's county is authoritative (geocoded, not hand-typed) —
  // most properties on this portfolio were imported with a placeholder
  // "UNKNOWN" county, so a real lookup is strictly better than what's there.
  if (record.county) {
    await db.update(properties).set({ county: record.county, updatedAt: new Date() }).where(eq(properties.id, propertyId));
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
  return { success: "Assessor data refreshed." };
}
