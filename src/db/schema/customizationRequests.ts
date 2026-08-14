import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const customizationTaskTypeEnum = pgEnum("customization_task_type", [
  "NEW_FEATURE",
  "ENHANCEMENT",
  "IMPROVEMENT",
  "BUG_FIX",
]);

export const customizationStatusEnum = pgEnum("customization_status", ["DRAFTING", "SUBMITTED"]);

// The "Program Customization" agent — Super User (staff_users.role = ADMIN)
// only. Conversationally drafts a Product Brief then an Engineering Brief,
// mirroring .claude/commands/product.md and engineering.md's own output
// shape, so an approved row here can be pasted straight into
// tasks/{task-name}/product-brief.md + task-brief.md for a real engineering
// session to pick up. This table only ever stores documentation — no code
// or deploy access exists anywhere in this feature.
export const customizationRequests = pgTable("customization_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  taskType: customizationTaskTypeEnum("task_type").notNull(),
  status: customizationStatusEnum("status").notNull().default("DRAFTING"),
  // JSON-stringified ChatMessage[] — kept for audit/context, not re-parsed
  // into structured columns.
  conversation: text("conversation").notNull(),
  productBriefMarkdown: text("product_brief_markdown"),
  engineeringBriefMarkdown: text("engineering_brief_markdown"),
  requestedBy: text("requested_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
