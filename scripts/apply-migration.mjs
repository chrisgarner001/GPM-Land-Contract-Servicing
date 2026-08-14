import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import { readFileSync } from "fs";

// Workaround for `drizzle-kit push` prompting an interactive TTY question
// about an unrelated pre-existing gl_codes constraint-naming drift, which
// fails non-interactively. Applies one generated migration file's statements
// directly and atomically. Usage: node scripts/apply-migration.mjs <path-to-sql>
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/apply-migration.mjs <path-to-migration.sql>");
const raw = readFileSync(file, "utf8");
const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

try {
  await sql.begin(async (tx) => {
    for (const stmt of statements) {
      console.log("Running:", stmt.slice(0, 80).replace(/\n/g, " "), "...");
      await tx.unsafe(stmt);
    }
  });
  console.log(`Applied ${statements.length} statements from ${file}`);
} finally {
  await sql.end();
}
