import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";
import { parties } from "./parties";

// Free-text staff notes on a contract — append-only, no editing/deleting for
// now (a note is a record of what was said/done, not a mutable field).
export const contractNotes = pgTable("contract_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id),
  authorEmail: text("author_email"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Same idea as contractNotes, but on the borrower/lender (party) themselves —
// for communications that apply to the person, not one specific contract.
export const partyNotes = pgTable("party_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id").notNull().references(() => parties.id),
  authorEmail: text("author_email"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Captured emails to/from a borrower via the shared info@successgroupmortgage.com
// mailbox — matched to a party via a loan-account number embedded in the
// subject line and/or a sender/recipient address matching the borrower's
// known email. Populated by an on-demand sync (staff/agent-triggered, not a
// live inbox connection), never edited after capture. gmailMessageId is
// unique so a re-run of the sync doesn't create duplicates.
export const partyEmails = pgTable("party_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id").notNull().references(() => parties.id),
  gmailMessageId: text("gmail_message_id").notNull().unique(),
  gmailThreadId: text("gmail_thread_id").notNull(),
  subject: text("subject"),
  sender: text("sender"),
  recipients: text("recipients"),
  snippet: text("snippet"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outgoingEmailStatusEnum = pgEnum("outgoing_email_status", ["PENDING", "DRAFTED"]);

// Staff-composed outgoing email, queued from the Borrower Communications
// area. The app has no Gmail send credentials of its own — this row is
// picked up on request and turned into a real Gmail draft in
// info@successgroupmortgage.com (gmailDraftId set, status -> DRAFTED) for a
// human to review and actually send from Gmail. There is no automated send
// path; once sent, the message reappears in `partyEmails` via the normal
// capture sync like any other real email.
export const partyEmailDrafts = pgTable("party_email_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id").notNull().references(() => parties.id),
  toAddress: text("to_address").notNull(),
  ccAddress: text("cc_address"),
  bccAddress: text("bcc_address"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: outgoingEmailStatusEnum("status").notNull().default("PENDING"),
  gmailDraftId: text("gmail_draft_id"),
  authorEmail: text("author_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  draftedAt: timestamp("drafted_at", { withTimezone: true }),
});
