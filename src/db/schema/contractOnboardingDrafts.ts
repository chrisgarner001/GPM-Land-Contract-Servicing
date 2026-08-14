import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const contractOnboardingDraftStatusEnum = pgEnum("contract_onboarding_draft_status", ["DRAFT", "PUBLISHED"]);

// The New Land Contract wizard (Borrower/Co-Borrower, Lender, Property,
// Contract & Escrow) is often filled in across more than one sitting — this
// table lets staff save partial progress and resume later, mirroring
// land_contract_packages. `answers` holds every wizard field keyed by its
// exact form field name (see NewContractWizard's step components) — one
// flexible JSON bucket rather than individual columns, since the form is
// always saved/resumed as a whole. borrowerName/propertyAddress are
// denormalized from `answers` on every save purely so the list page can
// render without parsing JSON.
//
// Unlike land_contract_packages, publishing here is NOT idempotent —
// creating a contract has real, non-idempotent side effects (a new party,
// property, and contract row), so once published a draft is locked and
// publishedContractId links to the real contract it became.
export const contractOnboardingDrafts = pgTable("contract_onboarding_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: contractOnboardingDraftStatusEnum("status").notNull().default("DRAFT"),

  borrowerName: text("borrower_name"),
  propertyAddress: text("property_address"),

  answers: jsonb("answers").notNull().default({}),

  publishedContractId: uuid("published_contract_id").references(() => contracts.id),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
