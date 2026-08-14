import { pgTable, uuid, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { parties } from "./parties";

export const postedLenderDocumentTypeEnum = pgEnum("posted_lender_document_type", [
  "ACCRUED_INTEREST",
  "PRINCIPAL_CHANGE",
  "PORTFOLIO_CHARGES",
  "ACH_PAYMENTS",
]);

// A frozen snapshot of a Lender report, posted from Reports > Lender so the
// lender can see it on their portal login — same pattern as
// posted_borrower_documents (frozen HTML, never re-run live).
export const postedLenderDocuments = pgTable("posted_lender_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  lenderPartyId: uuid("lender_party_id")
    .notNull()
    .references(() => parties.id),
  documentType: postedLenderDocumentTypeEnum("document_type").notNull(),
  rangeStart: date("range_start").notNull(),
  rangeEnd: date("range_end").notNull(),
  contentHtml: text("content_html").notNull(),
  postedBy: text("posted_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
});
