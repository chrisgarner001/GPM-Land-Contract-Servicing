import { NextRequest, NextResponse } from "next/server";
import { getServicingIncomeStatement } from "@/server/accountingReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing startDate/endDate." }, { status: 400 });
  }

  const data = await getServicingIncomeStatement(startDate, endDate);

  const buffer = await buildExcelWorkbook([
    {
      name: "Servicing Income Statement",
      columns: [
        { header: "Line Item", key: "item", width: 32 },
        { header: "Amount", key: "amount", width: 18 },
      ],
      rows: [
        { item: "Broker/Servicing Fees Collected", amount: formatCents(data.servicingFeesCents) },
        { item: "Net Servicing Income", amount: formatCents(data.totalIncomeCents) },
      ],
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="servicing-income-statement.xlsx"`,
    },
  });
}
