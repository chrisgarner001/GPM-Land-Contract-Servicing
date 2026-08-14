import { NextRequest, NextResponse } from "next/server";
import { getServicingBalanceSheet } from "@/server/accountingReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asOfDate = searchParams.get("asOfDate");
  if (!asOfDate) {
    return NextResponse.json({ error: "Missing asOfDate." }, { status: 400 });
  }

  const data = await getServicingBalanceSheet(asOfDate);

  const buffer = await buildExcelWorkbook([
    {
      name: "Servicing Balance Sheet",
      columns: [
        { header: "Line Item", key: "item", width: 40 },
        { header: "Amount", key: "amount", width: 18 },
      ],
      rows: [
        { item: "Escrow/Trust Held", amount: formatCents(data.escrowHeldCents) },
        { item: "Lender Payable", amount: formatCents(data.lenderPayableCents) },
        { item: "Borrower Reserve Held", amount: formatCents(data.borrowerReserveHeldCents) },
        { item: "Total Principal Under Servicing (memo)", amount: formatCents(data.totalPrincipalUnderServicingCents) },
      ],
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="servicing-balance-sheet.xlsx"`,
    },
  });
}
