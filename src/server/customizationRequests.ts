import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customizationRequests } from "@/db/schema/customizationRequests";

export type TaskType = "NEW_FEATURE" | "ENHANCEMENT" | "IMPROVEMENT" | "BUG_FIX";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Static architecture context — this in-app agent has no file-reading tools
// (unlike a real Claude Code session), so it can't read AGENTS.md/docs/src
// itself the way .claude/commands/product.md and engineering.md assume. This
// is a condensed, hand-maintained summary of the facts those two files lean
// on most, so the drafted briefs stay grounded instead of inventing
// architecture that doesn't exist here.
const ARCHITECTURE_CONTEXT = `
This is "Land Contract Servicing" (GPM), a Next.js App Router app for a land-contract loan servicing business. Known facts to stay grounded in:
- Solo-maintained, single \`main\` branch, no CI, no ticket tracker. Deploys via Vercel's git integration on push to main.
- Layers: src/domain (pure business logic — amortization, escrow, ledger, lending, money — each with *.test.ts, this is where money math must stay correct), src/server (orchestration/DB writes), src/app (routes + colocated Server Actions in actions.ts), src/db/schema (Drizzle ORM, one file per area).
- No REST/GraphQL API — everything is a Server Action. Auth is checked per-action, not centrally (aside from the staff Supabase-session gate in src/proxy.ts) — a new action that forgets to check who's calling it is a real, easy-to-miss gap.
- Money is stored and passed as whole-cent integers everywhere, only converted to a Decimal type transiently inside rate/amortization math — never as a floating-point dollar value.
- Existing top-level areas: Land Contracts, Borrowers, Lenders, Vendors, Reports (Borrower/Lender/Vendor/Loan), Notices (Borrower/Lender/Vendor/Template Builder), Tax Forms, Tax Bill Processing, Escrow Maintenance, Setup (Users/GL Codes/Bank Accounts), online borrower/lender self-service portals.
- Three auth systems: staff (Supabase), lender portal (its own email+PIN, HMAC-signed session cookie), borrower portal (contract-scoped PIN, HMAC-signed session cookie, currently only reachable via staff "Log In As" impersonation).
- Two genuinely sensitive fields exist and are AES-256-GCM encrypted at rest: full SSN/TIN and full ACH account number. Everything else is a plain column.
`.trim();

const PRODUCT_SYSTEM_PROMPT = `You are acting as the Product Designer for this app, converting a Super User's plain-language customization request into a scoped, structured brief — the same role this project's own .claude/commands/product.md defines. You do not write code or make engineering decisions.

${ARCHITECTURE_CONTEXT}

Your job in this conversation:
- Clarify intent and the actual outcome the user wants (jobs-to-be-done)
- Ask the MINIMUM clarification needed — make reasonable assumptions and state them rather than interrogating
- Flag anything that touches money movement (payments, escrow, lender/vendor disbursements) as needing extra care
- If the request conflicts with or would require changing the existing domain model/architecture above, say so explicitly rather than silently assuming it's fine
- When there are multiple reasonable approaches, present 2-3 with tradeoffs and a recommended default
- Keep replies conversational and short — you are chatting, not writing the brief yet`;

const ENGINEERING_SYSTEM_PROMPT = `You are acting as the Engineering planner for this app — the same role this project's own .claude/commands/engineering.md defines, but ONLY its Phase A (Planning). You do not write or implement any code; a human engineer does that afterward in a separate session.

${ARCHITECTURE_CONTEXT}

Given the Product Brief below, produce a Task Brief: a subtask breakdown ordered narrow-to-wide (schema -> domain -> server -> app/UI -> docs), the key files each subtask would likely touch, architecture contracts that must be preserved (e.g. money-as-cents, domain-layer purity, per-action auth checks), a testing plan (which domain functions would need new/updated *.test.ts coverage, if any), and database migration notes if the request implies a schema change. Be concrete and specific to THIS codebase, not generic software-engineering advice. Flag any risk you see clearly, even if it means saying this request is bigger or riskier than it sounds.`;

const client = new Anthropic();

export async function continueConversation(history: ChatMessage[], userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: PRODUCT_SYSTEM_PROMPT,
    messages: [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user" as const, content: userMessage }],
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("No response from the assistant.");
  return textBlock.text;
}

const PRODUCT_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "A short (under 10 word) title for this request." },
    taskType: { type: "string", enum: ["NEW_FEATURE", "ENHANCEMENT", "IMPROVEMENT", "BUG_FIX"] },
    problem: { type: "string" },
    outcomes: { type: "string" },
    successCriteria: { type: "string" },
    openQuestions: { type: "array", items: { type: "string" }, description: "At most 5 items." },
    decisionsNeeded: { type: "array", items: { type: "string" }, description: "At most 5 items." },
    risksUnknowns: { type: "array", items: { type: "string" }, description: "At most 5 items." },
  },
  required: ["title", "taskType", "problem", "outcomes", "successCriteria", "openQuestions", "decisionsNeeded", "risksUnknowns"],
  additionalProperties: false,
};

interface ProductBriefFields {
  title: string;
  taskType: TaskType;
  problem: string;
  outcomes: string;
  successCriteria: string;
  openQuestions: string[];
  decisionsNeeded: string[];
  risksUnknowns: string[];
}

function renderProductBriefMarkdown(f: ProductBriefFields): string {
  const list = (items: string[]) => (items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "- None identified");
  return `**Task Type:** ${f.taskType.replace("_", " ")}
**Problem:** ${f.problem}
**Outcomes:** ${f.outcomes}
**Success Criteria:** ${f.successCriteria}

---

## Handoff to Engineering

**Task Type:** ${f.taskType.replace("_", " ")}

### Open Questions (max 5)
${list(f.openQuestions)}

### Decisions Needed (max 5)
${list(f.decisionsNeeded)}

### Risks/Unknowns (max 5)
${list(f.risksUnknowns)}`;
}

const ENGINEERING_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    subtaskBreakdown: { type: "array", items: { type: "string" }, description: "Ordered narrow-to-wide: schema -> domain -> server -> app/UI -> docs." },
    keyFiles: { type: "array", items: { type: "string" } },
    architectureContracts: { type: "array", items: { type: "string" } },
    testingPlan: { type: "string" },
    dbMigrationNotes: { type: "string", description: "Empty string if no schema change is implied." },
    risks: { type: "array", items: { type: "string" } },
  },
  required: ["subtaskBreakdown", "keyFiles", "architectureContracts", "testingPlan", "dbMigrationNotes", "risks"],
  additionalProperties: false,
};

interface EngineeringBriefFields {
  subtaskBreakdown: string[];
  keyFiles: string[];
  architectureContracts: string[];
  testingPlan: string;
  dbMigrationNotes: string;
  risks: string[];
}

function renderEngineeringBriefMarkdown(f: EngineeringBriefFields): string {
  const list = (items: string[]) => (items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "- None identified");
  return `## Subtask Breakdown
${list(f.subtaskBreakdown)}

## Key Files
${list(f.keyFiles)}

## Architecture Contracts to Preserve
${list(f.architectureContracts)}

## Testing Plan
${f.testingPlan}

## Database Migration Notes
${f.dbMigrationNotes || "None — no schema change implied."}

## Risks
${list(f.risks)}`;
}

export interface GeneratedBriefs {
  title: string;
  taskType: TaskType;
  productBriefMarkdown: string;
  engineeringBriefMarkdown: string;
}

export async function generateBriefs(conversation: ChatMessage[]): Promise<GeneratedBriefs> {
  const productResponse = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: PRODUCT_SYSTEM_PROMPT + "\n\nProduce the final structured Product Brief for this conversation now.",
    output_config: { format: { type: "json_schema", schema: PRODUCT_BRIEF_SCHEMA } },
    messages: conversation.map((h) => ({ role: h.role, content: h.content })),
  });
  const productText = productResponse.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!productText) throw new Error("No response drafting the Product Brief.");
  const productFields = JSON.parse(productText.text) as ProductBriefFields;
  // The schema can only describe "at most 5" (Anthropic's structured
  // outputs don't support JSON Schema's maxItems on arrays) — enforce the
  // actual cap here instead.
  productFields.openQuestions = productFields.openQuestions.slice(0, 5);
  productFields.decisionsNeeded = productFields.decisionsNeeded.slice(0, 5);
  productFields.risksUnknowns = productFields.risksUnknowns.slice(0, 5);
  const productBriefMarkdown = renderProductBriefMarkdown(productFields);

  const engineeringResponse = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: ENGINEERING_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: ENGINEERING_BRIEF_SCHEMA } },
    messages: [{ role: "user", content: `Product Brief:\n\n${productBriefMarkdown}` }],
  });
  const engineeringText = engineeringResponse.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!engineeringText) throw new Error("No response drafting the Engineering Brief.");
  const engineeringFields = JSON.parse(engineeringText.text) as EngineeringBriefFields;
  const engineeringBriefMarkdown = renderEngineeringBriefMarkdown(engineeringFields);

  return { title: productFields.title, taskType: productFields.taskType, productBriefMarkdown, engineeringBriefMarkdown };
}

export interface SaveCustomizationRequestInput {
  id?: string;
  title: string;
  taskType: TaskType;
  status: "DRAFTING" | "SUBMITTED";
  conversation: ChatMessage[];
  productBriefMarkdown: string;
  engineeringBriefMarkdown: string;
  requestedBy: string | null;
}

export async function saveCustomizationRequest(input: SaveCustomizationRequestInput): Promise<{ id: string }> {
  const values = {
    title: input.title,
    taskType: input.taskType,
    status: input.status,
    conversation: JSON.stringify(input.conversation),
    productBriefMarkdown: input.productBriefMarkdown,
    engineeringBriefMarkdown: input.engineeringBriefMarkdown,
    requestedBy: input.requestedBy,
    updatedAt: new Date(),
  };
  if (input.id) {
    const [row] = await db
      .update(customizationRequests)
      .set(values)
      .where(eq(customizationRequests.id, input.id))
      .returning({ id: customizationRequests.id });
    return row;
  }
  const [row] = await db.insert(customizationRequests).values(values).returning({ id: customizationRequests.id });
  return row;
}

export async function listCustomizationRequests() {
  return db.select().from(customizationRequests).orderBy(desc(customizationRequests.createdAt));
}

export async function getCustomizationRequest(id: string) {
  const [row] = await db.select().from(customizationRequests).where(eq(customizationRequests.id, id));
  return row ?? null;
}
