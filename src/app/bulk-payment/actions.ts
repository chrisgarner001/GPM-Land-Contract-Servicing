"use server";

import { eq, and, or } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts, contractParties } from "@/db/schema/contracts";
import { parties } from "@/db/schema/parties";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";
import { extractCheckData } from "@/server/checkExtraction";
import { recordPayment } from "@/server/payments";

export interface BulkCheckRow {
  fileName: string;
  payerName: string;
  amountCents: number;
  checkNumber: string | null;
  date: string | null;
  matchedContractId: string | null;
  matchedContractLabel: string | null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(/\s+/).filter((t) => t.length > 1));
  const tokensB = new Set(normalize(b).split(/\s+/).filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const t of tokensA) if (tokensB.has(t)) shared++;
  return shared / Math.max(tokensA.size, tokensB.size);
}

async function findMatchingContract(payerName: string): Promise<{ id: string; label: string } | null> {
  if (!payerName) return null;

  const rows = await db
    .select({
      contractId: contracts.id,
      contractNumber: contracts.contractNumber,
      buyerName: parties.displayName,
    })
    .from(contractParties)
    .innerJoin(parties, eq(contractParties.partyId, parties.id))
    .innerJoin(contracts, eq(contractParties.contractId, contracts.id))
    .where(
      and(
        or(eq(contractParties.role, "BUYER"), eq(contractParties.role, "CO_BUYER")),
        eq(contracts.status, "ACTIVE")
      )
    );

  let best: { id: string; label: string; score: number } | null = null;
  for (const row of rows) {
    const score = tokenOverlapScore(payerName, row.buyerName);
    if (score > 0.4 && (!best || score > best.score)) {
      best = { id: row.contractId, label: `${row.contractNumber} — ${row.buyerName}`, score };
    }
  }
  return best ? { id: best.id, label: best.label } : null;
}

export async function extractChecks(formData: FormData): Promise<{ rows: BulkCheckRow[]; error?: string }> {
  const files = formData.getAll("checks").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { rows: [], error: "No check images selected." };

  const rows: BulkCheckRow[] = [];
  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");
      const extracted = await extractCheckData(base64, file.type || "image/png");
      const match = await findMatchingContract(extracted.payerName);
      rows.push({
        fileName: file.name,
        payerName: extracted.payerName,
        amountCents: extracted.amountCents,
        checkNumber: extracted.checkNumber,
        date: extracted.date,
        matchedContractId: match?.id ?? null,
        matchedContractLabel: match?.label ?? null,
      });
    } catch (err) {
      rows.push({
        fileName: file.name,
        payerName: `(Failed to read: ${err instanceof Error ? err.message : "unknown error"})`,
        amountCents: 0,
        checkNumber: null,
        date: null,
        matchedContractId: null,
        matchedContractLabel: null,
      });
    }
  }

  return { rows };
}

export interface BulkPaymentSubmission {
  contractId: string;
  amountCents: number;
  receivedDate: string;
  referenceNumber: string | null;
}

export interface BulkSubmitResult {
  recorded: number;
  failed: { contractId: string; error: string }[];
}

export async function submitBulkPayments(submissions: BulkPaymentSubmission[]): Promise<BulkSubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await requireEditAccess(user?.email);

  let recorded = 0;
  const failed: { contractId: string; error: string }[] = [];

  for (const s of submissions) {
    try {
      await recordPayment({
        contractId: s.contractId,
        receivedDate: s.receivedDate,
        amountCents: s.amountCents,
        paymentMethod: "CHECK",
        referenceNumber: s.referenceNumber,
        actorEmail: user?.email ?? null,
      });
      recorded++;
    } catch (err) {
      failed.push({ contractId: s.contractId, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return { recorded, failed };
}

export async function getActiveContractOptions(): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .select({ id: contracts.id, contractNumber: contracts.contractNumber, buyerName: parties.displayName })
    .from(contracts)
    .leftJoin(contractParties, and(eq(contractParties.contractId, contracts.id), eq(contractParties.role, "BUYER")))
    .leftJoin(parties, eq(contractParties.partyId, parties.id))
    .where(eq(contracts.status, "ACTIVE"))
    .orderBy(contracts.contractNumber);

  return rows.map((r) => ({ id: r.id, label: `${r.contractNumber} — ${r.buyerName ?? "Unknown"}` }));
}
