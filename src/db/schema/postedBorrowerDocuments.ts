import { pgTable, uuid, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const postedDocumentTypeEnum = pgEnum("posted_document_type", ["STATEMENT_OF_ACCOUNT", "OUTSTANDING_CHARGES", "PAYOFF_LETTER"]);

// A frozen snapshot of a Borrower report, posted from Reports > Borrower so
// the borrower can see it on their portal login. contentHtml is exactly what
// was rendered at posting time — the portal shows this stored HTML verbatim,
// never re-runs the report live, since a financial statement shouldn't
// silently change after the fact (e.g. once the underlying balance moves).
export const postedBorrowerDocuments = pgTable("posted_borrower_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id),
  documentType: postedDocumentTypeEnum("document_type").notNull(),
  rangeStart: date("range_start").notNull(),
  rangeEnd: date("range_end").notNull(),
  contentHtml: text("content_html").notNull(),
  postedBy: text("posted_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
});
