import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { glCodes } from "@/db/schema/setup";
import { buildExcelWorkbook } from "@/lib/excel";
import { GL_CODE_TYPE_LABELS } from "../glCodeTypeLabels";

export async function GET() {
  const rows = await db.select().from(glCodes).orderBy(glCodes.code);

  const buffer = await buildExcelWorkbook([
    {
      name: "Chart of Accounts",
      columns: [
        { header: "Code", key: "code", width: 12 },
        { header: "Description", key: "description", width: 40 },
        { header: "Type", key: "type", width: 22 },
      ],
      rows: rows.map((r) => ({
        code: r.code,
        description: r.description ?? "",
        type: r.type ? GL_CODE_TYPE_LABELS[r.type] ?? r.type : "",
      })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="chart-of-accounts.xlsx"`,
    },
  });
}
