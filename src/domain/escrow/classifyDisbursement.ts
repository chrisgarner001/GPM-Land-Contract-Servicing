export type DisbursementKind = "TAX" | "INSURANCE" | "OTHER";

// TMO's migrated trust ledger history never classified entries by
// category/voucherType (confirmed: 100% null across all 22,877 rows) — this
// heuristic reads the same signal a human would (payee name / memo text) to
// tell tax disbursements from insurance ones. Read-only/presentation-only;
// shared by the per-contract Escrow Analysis page and the portfolio-wide
// Escrow Maintenance page so both classify identically.
export function classifyDisbursement(description: string | null, payee: string | null): DisbursementKind {
  const text = `${description ?? ""} ${payee ?? ""}`.toLowerCase();
  if (text.includes("tax")) return "TAX";
  if (text.includes("insur") || text.includes("hoi") || text.includes("homeowner")) return "INSURANCE";
  return "OTHER";
}
