import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import os from "os";
import path from "path";

/**
 * Pre-wipe safety net: dumps every row of every table in the public schema
 * to JSON. Not a substitute for a real pg_dump (no schema/DDL captured —
 * migrations already applied remain the schema's source of truth; this is
 * data only), but preserves exact row data so it could be restored by hand
 * if something goes wrong. Written outside the repo — never commit a DB
 * dump (PII: names, addresses, phone numbers, encrypted-but-still-sensitive
 * tax ID fields).
 *
 * Usage: npx tsx scripts/backup-db.ts <output-dir>
 * Defaults to a timestamped folder in the OS temp dir if no path is given.
 */
async function run() {
  const { db } = await import("../src/db/client");

  const outDir = process.argv[2] || path.join(os.tmpdir(), `land-contract-db-backup-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(outDir, { recursive: true });

  const tablesResult = await db.execute(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables = ((tablesResult as unknown as { rows?: { table_name: string }[] }).rows ?? (tablesResult as unknown as { table_name: string }[])) as {
    table_name: string;
  }[];

  const summary: { table: string; rows: number }[] = [];
  for (const { table_name } of tables) {
    const result = await db.execute(`SELECT * FROM "${table_name}"`);
    const rows = (result as unknown as { rows?: unknown[] }).rows ?? (result as unknown as unknown[]);
    fs.writeFileSync(path.join(outDir, `${table_name}.json`), JSON.stringify(rows));
    summary.push({ table: table_name, rows: (rows as unknown[]).length });
    console.log(`${table_name}: ${(rows as unknown[]).length} rows`);
  }

  fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nBackup written to ${outDir}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
