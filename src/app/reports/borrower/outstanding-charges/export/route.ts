import { NextRequest, NextResponse } from "next/server";
import { getOutstandingChargesData } from "@/server/borrowerReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!contractId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing contractId/startDate/endDate." }, { status: 400 });
  }

  const data = await getOutstandingChargesData(contractId, startDate, endDate);

  const buffer = await buildExcelWorkbook([
    {
      name: "Outstanding Charges",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Description", key: "description", width: 30 },
        { header: "Amount", key: "amount", width: 16 },
        { header: "Remaining", key: "remaining", width: 16 },
      ],
      rows: data.charges.map((c) => ({
        date: formatDate(c.chargeDate),
        description: c.description,
        amount: formatCents(c.amountCents),
        remaining: formatCents(c.remainingCents),
      })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="outstanding-charges-${data.contractNumber}.xlsx"`,
    },
  });
}
