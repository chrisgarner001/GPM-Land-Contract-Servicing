import { sql } from "drizzle-orm";
import { checks } from "@/db/schema/checks";

// TMO's "Check Register with Detail" export mixes vendor payees, lender
// payees, and internal payees (SGMS/broker) in one report — confirmed
// against real data: of ~211 distinct payee codes, checks.payee_code matches
// a vendors.vendor_account_code for vendor payments, and for lender payments
// checks.payee_name matches an INVESTOR_PAYEE party's display_name exactly —
// except the three "ETC Custodian FBO" sub-accounts, which were disambiguated
// at import time as "ETC Custodian FBO (<code>)" while the check's own
// payee_name lacks the suffix; those are matched by payee_code against the
// parenthetical code instead. A small number of historical payees (e.g. a
// one-off individual, an old code with no current investor role) match
// neither bucket — kept as SQL so both the Vendor and Lender Check Register
// pages classify every row identically.
export const isLenderPayeeSql = sql`(
  ${checks.payeeName} IN (
    SELECT DISTINCT p.display_name FROM parties p
    JOIN contract_parties cp ON cp.party_id = p.id
    WHERE cp.role = 'INVESTOR_PAYEE'
  )
  OR ${checks.payeeCode} IN (
    SELECT DISTINCT substring(p.display_name from '\\(([^)]+)\\)$') FROM parties p
    JOIN contract_parties cp ON cp.party_id = p.id
    WHERE cp.role = 'INVESTOR_PAYEE' AND p.display_name ~ '\\(.+\\)$'
  )
)`;
