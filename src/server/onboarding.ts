import { like, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { contracts } from "@/db/schema/contracts";

// Imported (TMO-#####) contracts have their own namespace — this only ever
// looks at/generates LC-##### numbers, so it can never collide with them.
const PREFIX = "LC-";
const PAD_LENGTH = 5;

export async function getNextContractNumber(): Promise<string> {
  const rows = await db
    .select({ contractNumber: contracts.contractNumber })
    .from(contracts)
    .where(like(contracts.contractNumber, `${PREFIX}%`))
    .orderBy(desc(contracts.contractNumber))
    .limit(1);

  const last = rows[0]?.contractNumber;
  const lastNumber = last ? Number(last.slice(PREFIX.length)) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;

  return `${PREFIX}${String(next).padStart(PAD_LENGTH, "0")}`;
}
