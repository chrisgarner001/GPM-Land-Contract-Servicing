import { pgTable, uuid, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { contracts } from "./contracts";

export const noticeCategoryEnum = pgEnum("notice_category", ["BORROWER", "LENDER", "VENDOR"]);

export const noticeChannelEnum = pgEnum("notice_channel", ["EMAIL", "LETTER"]);

export const noticeSendStatusEnum = pgEnum("notice_send_status", ["SENT", "FAILED"]);

// Built via the Template Builder wizard (Notices > Template Builder): a
// staff member converses with Claude about what the notice should say, and
// only the final APPROVED draft is ever persisted here — there's no
// in-progress/draft row, since the conversation itself lives as client-side
// state until Approve is clicked. bodyTemplate (and subject, for EMAIL) hold
// {{mergeField}} tokens rendered per-recipient by
// domain/notices/renderNoticeTemplate.ts at send time.
export const noticeTemplates = pgTable("notice_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: noticeCategoryEnum("category").notNull(),
  channel: noticeChannelEnum("channel").notNull(),
  name: text("name").notNull(),
  // EMAIL only — LETTER notices have no subject line.
  subject: text("subject"),
  bodyTemplate: text("body_template").notNull(),
  // BORROWER only — set only for threshold-based Late Notice templates
  // (e.g. "60+ days past due"). Null means the template applies to any
  // single recipient the way every template does today.
  minDaysPastDue: integer("min_days_past_due"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per actual send (EMAIL only today — LETTER stays an on-screen
// print preview, no send action exists for it). recipientId is polymorphic
// by category rather than an FK: a parties.id for BORROWER/LENDER, a
// vendors.id for VENDOR — those are two different tables, so it can't be a
// single foreign key.
export const noticeSends = pgTable("notice_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => noticeTemplates.id),
  category: noticeCategoryEnum("category").notNull(),
  recipientId: uuid("recipient_id").notNull(),
  // BORROWER only — which contract's data was merged in (a borrower party
  // could in principle span more than one contract).
  contractId: uuid("contract_id").references(() => contracts.id),
  channel: noticeChannelEnum("channel").notNull(),
  subjectRendered: text("subject_rendered"),
  bodyRendered: text("body_rendered").notNull(),
  status: noticeSendStatusEnum("status").notNull(),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});
