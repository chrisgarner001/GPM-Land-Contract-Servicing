import { pgTable, uuid, text, date, bigint, timestamp } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { vendors } from "./vendors";

// A borrower-owed charge that isn't collected from escrow — e.g. a vendor
// invoice posted via New Invoice's "Charge Lender" mode, where the servicer
// fronts the vendor payment against the lender's ledger and the borrower
// owes it back over time. remainingCents starts equal to amountCents and is
// decremented (FIFO, oldest chargeDate first) as the borrower's payments
// apply an amount toward "Pay Charges" — see server/payments.ts.
export const contractCharges = pgTable("contract_charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  description: text("description").notNull(),
  chargeDate: date("charge_date").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  remainingCents: bigint("remaining_cents", { mode: "number" }).notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
