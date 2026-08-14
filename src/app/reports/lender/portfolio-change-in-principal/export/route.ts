import { NextRequest, NextResponse } from "next/server";
import { getPrincipalChangeData, getLenderOptions } from "@/server/lenderReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lenderIds = searchParams.getAll("lenderIds");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (lenderIds.length === 0 || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing lenderIds/startDate/endDate." }, { status: 400 });
  }

  const lenderOptions = await getLenderOptions();
  const lendersById = new Map(lenderOptions.map((l) => [l.id, l.displayName]));
  const statements = await getPrincipalChangeData(lenderIds, startDate, endDate);

  const rows = statements.flatMap((s) =>
    s.rows.map((r) => ({
      lender: lendersById.get(s.lenderId) ?? "Unknown",
      contractNumber: r.contractNumber,
      principalChange: formatCents(r.principalChangeCents),
    }))
  );

  const buffer = await buildExcelWorkbook([
    {
      name: "Portfolio Change in Principal",
      columns: [
        { header: "Lender", key: "lender", width: 22 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Principal Change", key: "principalChange", width: 18 },
      ],
      rows,
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="portfolio-change-in-principal.xlsx"`,
    },
  });
}
