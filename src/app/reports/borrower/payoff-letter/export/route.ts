import { NextRequest, NextResponse } from "next/server";
import { getPayoffLetterData } from "@/server/borrowerReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const payoffDate = searchParams.get("payoffDate");
  const recipientName = searchParams.get("recipientName") ?? "";
  if (!contractId || !payoffDate) {
    return NextResponse.json({ error: "Missing contractId/payoffDate." }, { status: 400 });
  }

  const data = await getPayoffLetterData(contractId, payoffDate, recipientName);

  const buffer = await buildExcelWorkbook([
    {
      name: "Payoff Letter",
      columns: [
        { header: "Field", key: "field", width: 26 },
        { header: "Value", key: "value", width: 24 },
      ],
      rows: [
        { field: "Land Contract", value: data.contractNumber },
        { field: "Borrower", value: data.borrowerName },
        { field: "Sent To", value: data.recipientName },
        { field: "Payoff Date", value: formatDate(data.payoffDate) },
        { field: "Principal Balance", value: formatCents(data.quote.principalBalanceCents) },
        { field: `Accrued Interest (${data.quote.days} days)`, value: formatCents(data.quote.accruedInterestCents) },
        { field: "Unpaid Prior Interest", value: formatCents(data.quote.unpaidInterestCents) },
        { field: "Late Charges", value: formatCents(data.quote.unpaidLateChargesCents) },
        { field: "Other Charges", value: formatCents(data.quote.unpaidOtherChargesCents) },
        { field: "Total Payoff Amount", value: formatCents(data.quote.totalPayoffAmountCents) },
        { field: "Per Diem After Payoff Date", value: formatCents(data.quote.perDiemInterestCents) },
        { field: "Quote Valid Through", value: formatDate(data.expirationDate) },
      ],
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="payoff-letter-${data.contractNumber}.xlsx"`,
    },
  });
}
