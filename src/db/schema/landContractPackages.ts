import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const landContractPackageStatusEnum = pgEnum("land_contract_package_status", ["DRAFT", "PUBLISHED"]);

// A land contract closing package is drafted and signed by all parties
// BEFORE the contract exists anywhere else in this app — there is no
// property/contract/party record to attach it to yet, so this is a fully
// standalone, resumable form. `answers` holds every Q&A field keyed by the
// same {tag} names the document templates use (see
// src/document-templates/land-contract-package/) — one flexible JSON bucket
// rather than ~50 individual columns for a form that's always edited as a
// whole and never queried field-by-field. buyerName/propertyAddress/
// closingDate are denormalized from `answers` on every save purely so the
// packages list page can render without parsing JSON.
export const landContractPackages = pgTable("land_contract_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: landContractPackageStatusEnum("status").notNull().default("DRAFT"),

  buyerName: text("buyer_name"),
  propertyAddress: text("property_address"),
  closingDate: text("closing_date"),

  answers: jsonb("answers").notNull().default({}),

  // Set once Publish succeeds and every file has uploaded.
  driveFolderUrl: text("drive_folder_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
