import { NextRequest, NextResponse } from "next/server";
import { getBorrower1098Data } from "@/server/taxForms";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taxYear = Number(searchParams.get("taxYear"));
  if (!taxYear) {
    return NextResponse.json({ error: "Missing taxYear." }, { status: 400 });
  }

  const rows = await getBorrower1098Data(taxYear);

  const buffer = await buildExcelWorkbook([
    {
      name: `1098 ${taxYear}`,
      columns: [
        { header: "Borrower", key: "borrowerName", width: 24 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Interest Received (Box 1)", key: "total", width: 22 },
        { header: "Meets $600 Threshold", key: "meets", width: 18 },
      ],
      rows: rows.map((r) => ({
        borrowerName: r.borrowerName,
        contractNumber: r.contractNumber,
        total: formatCents(r.totalInterestCents),
        meets: r.meetsThreshold ? "Yes" : "No",
      })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="1098-worksheet-${taxYear}.xlsx"`,
    },
  });
}
