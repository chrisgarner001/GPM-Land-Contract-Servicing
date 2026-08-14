import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const documentTypeEnum = pgEnum("document_type", ["QCD", "WD", "WDS", "LC", "QCDLC", "LCA"]);

// Audit trail only — the app never stores generated files (no blob storage
// anywhere in this codebase; every export/report is generate-on-demand).
// dataSnapshot is the exact field-value JSON the deed was rendered from, so
// a past deed's contents can be reviewed/reconstructed without re-deriving
// them from whatever the contract/property/party rows say today.
export const generatedDocuments = pgTable("generated_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").references(() => contracts.id),
  docType: documentTypeEnum("doc_type").notNull(),
  grantorName: text("grantor_name"),
  granteeName: text("grantee_name"),
  propertyAddress: text("property_address"),
  dataSnapshot: text("data_snapshot").notNull(),
  generatedBy: text("generated_by"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
