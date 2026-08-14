import { NextRequest, NextResponse } from "next/server";
import { getLender1099Data } from "@/server/taxForms";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taxYear = Number(searchParams.get("taxYear"));
  if (!taxYear) {
    return NextResponse.json({ error: "Missing taxYear." }, { status: 400 });
  }

  const rows = await getLender1099Data(taxYear);

  const buffer = await buildExcelWorkbook([
    {
      name: `1099-INT ${taxYear}`,
      columns: [
        { header: "Lender", key: "displayName", width: 28 },
        { header: "Interest Paid (Box 1)", key: "total", width: 20 },
        { header: "Meets $10 Threshold", key: "meets", width: 18 },
      ],
      rows: rows.map((r) => ({ displayName: r.displayName, total: formatCents(r.totalInterestCents), meets: r.meetsThreshold ? "Yes" : "No" })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="1099-int-worksheet-${taxYear}.xlsx"`,
    },
  });
}
