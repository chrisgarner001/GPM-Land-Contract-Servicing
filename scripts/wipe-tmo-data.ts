import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Clears every table that (directly or transitively) depends on contracts,
 * properties, parties, or checks — the full set of servicing/transactional
 * data, verified against Postgres's own foreign-key catalog (not just a
 * manual read of the schema) to be certain nothing is missed:
 *
 *   amortization_schedule_versions, check_line_items, checks,
 *   contract_charges, contract_notes, contract_parties, contracts,
 *   escrow_analyses, escrow_vouchers, generated_documents,
 *   lender_ledger_entries, notice_sends, parties, party_email_drafts,
 *   party_emails, party_notes, payment_allocations, payments, properties,
 *   posted_borrower_documents, posted_lender_documents, scheduled_payments,
 *   trust_ledger_entries, vendor_disbursements
 *
 * Deliberately NOT touched (confirmed config, not TMO/contract data):
 * vendors, bank_accounts, notice_templates, gl_codes, staff_users,
 * customization_requests.
 *
 * This is a one-way, irreversible operation against whatever database
 * DATABASE_URL points at — intended to prep for a clean re-import ahead of
 * go-live, not something to run against a live production system with real
 * unrecoverable activity. Take a fresh backup immediately before running
 * this with --apply; see scripts/backup-db.ts (or an equivalent dump) for a
 * copy of every row before it's cleared.
 *
 * Usage: npx tsx scripts/wipe-tmo-data.ts --apply
 */
async function run() {
  const { db } = await import("../src/db/client");

  const apply = process.argv.includes("--apply");

  const before = await db.execute(`
    SELECT 'contracts' t, count(*) n FROM contracts
    UNION ALL SELECT 'properties', count(*) FROM properties
    UNION ALL SELECT 'parties', count(*) FROM parties
    UNION ALL SELECT 'payments', count(*) FROM payments
    UNION ALL SELECT 'trust_ledger_entries', count(*) FROM trust_ledger_entries
    UNION ALL SELECT 'lender_ledger_entries', count(*) FROM lender_ledger_entries
    UNION ALL SELECT 'checks', count(*) FROM checks
    UNION ALL SELECT 'vendor_disbursements', count(*) FROM vendor_disbursements
  `);
  console.log("Current row counts (top-level tables):");
  for (const row of (before as unknown as { rows?: unknown[] }).rows ?? (before as unknown as unknown[])) {
    console.log(" ", row);
  }

  if (!apply) {
    console.log(
      "\nDry run only — pass --apply to actually run:\n" +
        "  TRUNCATE TABLE contracts, properties, parties, checks CASCADE;\n" +
        "This clears every table listed in this file's header comment. vendors, bank_accounts, notice_templates,\n" +
        "gl_codes, and staff_users are untouched."
    );
    return;
  }

  console.log("\nApplying — TRUNCATE TABLE contracts, properties, parties, checks CASCADE;");
  await db.execute(`TRUNCATE TABLE contracts, properties, parties, checks CASCADE`);
  console.log("Done. All contract/property/party/check-dependent data has been cleared.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
