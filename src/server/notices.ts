import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gt, isNull, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { noticeTemplates, noticeSends } from "@/db/schema/notices";
import { parties, properties } from "@/db/schema/parties";
import { contracts, contractParties } from "@/db/schema/contracts";
import { vendors, vendorDisbursements } from "@/db/schema/vendors";
import { calculateAmountDue, daysPastDue } from "@/domain/ledger/calculateAmountDue";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

export type NoticeCategory = "BORROWER" | "LENDER" | "VENDOR";
export type NoticeChannel = "EMAIL" | "LETTER";

export const MERGE_FIELDS: Record<NoticeCategory, { key: string; description: string }[]> = {
  BORROWER: [
    { key: "borrowerName", description: "Borrower's full name" },
    { key: "contractNumber", description: "Land contract number" },
    { key: "propertyAddress", description: "Property street address" },
    { key: "amountDue", description: "Total amount currently due (regular payment + late fee, if any)" },
    { key: "lateFee", description: "Late fee amount, if currently late (blank otherwise)" },
    { key: "daysPastDue", description: "Number of days past due (0 if current)" },
    { key: "nextPaymentDate", description: "Next payment due date" },
    { key: "principalBalance", description: "Current principal balance" },
    { key: "mailingAddress", description: "Borrower's mailing address, multi-line" },
  ],
  LENDER: [
    { key: "lenderName", description: "Lender's full name" },
    { key: "portfolioBalance", description: "Current total principal balance across the lender's active holdings" },
    { key: "portfolioYield", description: "Balance-weighted average interest rate across the lender's active holdings" },
    { key: "mailingAddress", description: "Lender's mailing address, multi-line" },
  ],
  VENDOR: [
    { key: "vendorName", description: "Vendor's display name" },
    { key: "vendorAccountCode", description: "Vendor's account code" },
    { key: "totalDisbursed", description: "Lifetime total disbursed to this vendor" },
    { key: "mailingAddress", description: "Vendor's mailing address" },
  ],
};

export interface RecipientOption {
  id: string;
  displayName: string;
  email: string | null;
  contractId?: string;
  daysPastDue?: number;
}

// BORROWER recipients are contract-scoped (id = contractId), not party-scoped
// — the merge fields (amount due, next payment date, balance) all belong to
// a specific contract, and a borrower party could in principle have more
// than one.
export async function getRecipientOptions(category: NoticeCategory): Promise<RecipientOption[]> {
  if (category === "BORROWER") {
    const rows = await db
      .select({
        contractId: contracts.id,
        contractNumber: contracts.contractNumber,
        displayName: parties.displayName,
        email: parties.email,
        nextPaymentDate: contracts.nextPaymentDate,
      })
      .from(contractParties)
      .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
      .innerJoin(parties, eq(contractParties.partyId, parties.id))
      // Bankruptcy's automatic stay prohibits creditor communication — these
      // borrowers can never appear as a selectable notice recipient, full
      // stop. (Staff can still reply manually if the borrower reaches out
      // first, from their own detail page — that's a human judgment call
      // this bulk-send list can't make.) Paid-off/defaulted/foreclosed/
      // cancelled contracts drop out the same way — only ACTIVE borrowers
      // are ever eligible bulk-notice recipients.
      .where(
        and(eq(contractParties.role, "BUYER"), eq(contracts.inBankruptcy, false), eq(contracts.status, "ACTIVE"))
      )
      .orderBy(parties.displayName);
    return rows.map((r) => ({
      id: r.contractId,
      contractId: r.contractId,
      displayName: `${r.displayName} — ${r.contractNumber}`,
      email: r.email,
      daysPastDue: daysPastDue(r.nextPaymentDate),
    }));
  }

  if (category === "LENDER") {
    const rows = await db
      .selectDistinct({ id: parties.id, displayName: parties.displayName, email: parties.email })
      .from(parties)
      .innerJoin(
        contractParties,
        and(eq(contractParties.partyId, parties.id), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"))
      )
      .orderBy(parties.displayName);
    return rows;
  }

  const rows = await db
    .select({ id: vendors.id, displayName: vendors.displayName, email: vendors.email })
    .from(vendors)
    .orderBy(vendors.displayName);
  return rows;
}

async function getBorrowerMergeFields(contractId: string): Promise<Record<string, string>> {
  const [contract] = await db
    .select({
      contractNumber: contracts.contractNumber,
      paymentAmountCents: contracts.paymentAmountCents,
      nextPaymentDate: contracts.nextPaymentDate,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
      lateFeeGraceDays: contracts.lateFeeGraceDays,
      lateFeeType: contracts.lateFeeType,
      lateFeeAmountCents: contracts.lateFeeAmountCents,
      lateFeePercent: contracts.lateFeePercent,
      propertyId: contracts.propertyId,
    })
    .from(contracts)
    .where(eq(contracts.id, contractId));
  if (!contract) throw new Error("Contract not found.");

  const [property] = await db.select().from(properties).where(eq(properties.id, contract.propertyId));

  const [buyer] = await db
    .select({
      displayName: parties.displayName,
      mailingAddressLine1: parties.mailingAddressLine1,
      mailingAddressLine2: parties.mailingAddressLine2,
      mailingCity: parties.mailingCity,
      mailingState: parties.mailingState,
      mailingZip: parties.mailingZip,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .where(and(eq(contractParties.contractId, contractId), eq(contractParties.role, "BUYER")));

  const pastDue = daysPastDue(contract.nextPaymentDate);
  const amountDue = calculateAmountDue({
    paymentAmountCents: contract.paymentAmountCents,
    daysPastDue: pastDue,
    lateFeeGraceDays: contract.lateFeeGraceDays,
    lateFeeType: contract.lateFeeType,
    lateFeeAmountCents: contract.lateFeeAmountCents,
    lateFeePercent: contract.lateFeePercent,
  });

  const mailingAddress = buyer
    ? [buyer.mailingAddressLine1, buyer.mailingAddressLine2, [buyer.mailingCity, buyer.mailingState, buyer.mailingZip].filter(Boolean).join(", ")]
        .filter(Boolean)
        .join("\n")
    : "";

  return {
    borrowerName: buyer?.displayName ?? "",
    contractNumber: contract.contractNumber,
    propertyAddress: property?.streetAddress ?? "",
    amountDue: formatCents(amountDue.amountDueCents),
    lateFee: amountDue.lateFeeCents > 0 ? formatCents(amountDue.lateFeeCents) : "",
    daysPastDue: String(pastDue),
    nextPaymentDate: formatDate(contract.nextPaymentDate),
    principalBalance: formatCents(contract.currentPrincipalBalanceCents),
    mailingAddress,
  };
}

async function getLenderMergeFields(lenderId: string): Promise<Record<string, string>> {
  const [lender] = await db.select().from(parties).where(eq(parties.id, lenderId));
  if (!lender) throw new Error("Lender not found.");

  const holdings = await db
    .select({
      interestRateAnnual: contracts.interestRateAnnual,
      currentPrincipalBalanceCents: contracts.currentPrincipalBalanceCents,
    })
    .from(contractParties)
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .where(
      and(eq(contractParties.partyId, lenderId), eq(contractParties.role, "INVESTOR_PAYEE"), gt(contractParties.ownershipPercent, "0"), isNull(contractParties.endDate))
    );

  const portfolioBalanceCents = holdings.reduce((s, h) => s + h.currentPrincipalBalanceCents, 0);
  const weightedSum = holdings.reduce((s, h) => s + Number(h.interestRateAnnual) * h.currentPrincipalBalanceCents, 0);
  const portfolioYield = portfolioBalanceCents > 0 ? weightedSum / portfolioBalanceCents : null;

  const mailingAddress = [lender.mailingAddressLine1, lender.mailingAddressLine2, [lender.mailingCity, lender.mailingState, lender.mailingZip].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join("\n");

  return {
    lenderName: lender.displayName,
    portfolioBalance: formatCents(portfolioBalanceCents),
    portfolioYield: formatPercent(portfolioYield),
    mailingAddress,
  };
}

async function getVendorMergeFields(vendorId: string): Promise<Record<string, string>> {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
  if (!vendor) throw new Error("Vendor not found.");

  const [row] = await db
    .select({ total: sum(vendorDisbursements.amountCents) })
    .from(vendorDisbursements)
    .where(eq(vendorDisbursements.vendorId, vendorId));

  return {
    vendorName: vendor.displayName,
    vendorAccountCode: vendor.vendorAccountCode,
    totalDisbursed: formatCents(Number(row?.total ?? 0)),
    mailingAddress: [vendor.addressLine1, vendor.cityStateZip].filter(Boolean).join("\n"),
  };
}

export async function getMergeFieldValues(category: NoticeCategory, recipientId: string): Promise<Record<string, string>> {
  if (category === "BORROWER") return getBorrowerMergeFields(recipientId);
  if (category === "LENDER") return getLenderMergeFields(recipientId);
  return getVendorMergeFields(recipientId);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NoticeDraft {
  subject: string | null;
  body: string;
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    assistantReply: {
      type: "string",
      description: "A short conversational reply to the user — confirm what changed, or ask a clarifying question if their request was ambiguous.",
    },
    subject: {
      type: ["string", "null"],
      description: "The email subject line. Must be null for a Letter (letters have no subject line).",
    },
    body: {
      type: "string",
      description: "The full notice text, using {{mergeField}} tokens from the provided list where a value should be personalized per recipient.",
    },
  },
  required: ["assistantReply", "subject", "body"],
  additionalProperties: false,
};

const client = new Anthropic();

// Conversational drafting — each call gets the full merge-field list for
// this category/channel plus the current draft (if any) as explicit context,
// so Claude always edits the SAME draft rather than reconstructing it from
// a potentially lossy chat transcript.
export async function draftNoticeContent(
  category: NoticeCategory,
  channel: NoticeChannel,
  history: ChatMessage[],
  currentDraft: NoticeDraft | null,
  userMessage: string
): Promise<{ assistantReply: string; draft: NoticeDraft }> {
  const fieldList = MERGE_FIELDS[category].map((f) => `- {{${f.key}}}: ${f.description}`).join("\n");
  const systemPrompt = `You help servicing staff draft a ${channel === "EMAIL" ? "email" : "letter"} notice template for the ${category.toLowerCase()} category of a land contract servicing system.

Write using these merge field tokens (exactly as shown, e.g. {{borrowerName}}) wherever a value should be personalized per recipient rather than fixed text:
${fieldList}

${channel === "EMAIL" ? "Include a subject line." : "This is a printed letter — subject must be null, and the body should open with a salutation and address block as a real letter would (the recipient's mailingAddress merge field is available for this)."}

${currentDraft ? `Current draft:\nSubject: ${currentDraft.subject ?? "(none)"}\nBody:\n${currentDraft.body}\n\nUpdate this draft based on the user's latest message below — don't discard prior content unless asked to.` : "There is no draft yet — write one based on the user's message below."}`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: systemPrompt,
    output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
    messages: [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user" as const, content: userMessage }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("No response from the drafting assistant.");

  const parsed = JSON.parse(textBlock.text) as { assistantReply: string; subject: string | null; body: string };
  return { assistantReply: parsed.assistantReply, draft: { subject: parsed.subject, body: parsed.body } };
}

export interface SaveNoticeTemplateInput {
  category: NoticeCategory;
  channel: NoticeChannel;
  name: string;
  subject: string | null;
  bodyTemplate: string;
  minDaysPastDue: number | null;
  createdBy: string | null;
}

export async function saveNoticeTemplate(input: SaveNoticeTemplateInput): Promise<{ id: string }> {
  const [row] = await db.insert(noticeTemplates).values(input).returning({ id: noticeTemplates.id });
  return row;
}

export interface RecordNoticeSendInput {
  templateId: string;
  category: NoticeCategory;
  recipientId: string;
  contractId: string | null;
  subjectRendered: string | null;
  bodyRendered: string;
  status: "SENT" | "FAILED";
  providerMessageId: string | null;
  errorMessage: string | null;
}

export async function recordNoticeSend(input: RecordNoticeSendInput): Promise<void> {
  await db.insert(noticeSends).values({ ...input, channel: "EMAIL" });
}
