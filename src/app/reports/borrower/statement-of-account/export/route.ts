import { NextRequest, NextResponse } from "next/server";
import { getStatementOfAccountData } from "@/server/borrowerReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!contractId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing contractId/startDate/endDate." }, { status: 400 });
  }

  const data = await getStatementOfAccountData(contractId, startDate, endDate);

  const buffer = await buildExcelWorkbook([
    {
      name: "Summary",
      columns: [
        { header: "Field", key: "field", width: 24 },
        { header: "Value", key: "value", width: 30 },
      ],
      rows: [
        { field: "Land Contract", value: data.contractNumber },
        { field: "Borrower", value: data.borrowerName },
        { field: "Property Address", value: data.propertyAddress },
        { field: "Principal Balance", value: formatCents(data.currentPrincipalBalanceCents) },
        { field: "Interest Rate", value: formatPercent(data.interestRateAnnual) },
        { field: "Next Payment Date", value: formatDate(data.nextPaymentDate) },
        { field: "Maturity Date", value: formatDate(data.maturityDate) },
        { field: "Regular Payment", value: formatCents(data.paymentAmountCents) },
        { field: "Escrow Balance", value: formatCents(data.escrowBalanceCents) },
        { field: "Reserve Balance", value: formatCents(data.reserveBalanceCents) },
      ],
    },
    {
      name: "Payment History",
      columns: [
        { header: "Date", key: "date", width: 14 },
        { header: "Due Date (est.)", key: "dueDate", width: 16 },
        { header: "Method", key: "method", width: 16 },
        { header: "Amount", key: "amount", width: 16 },
        { header: "Status", key: "status", width: 14 },
      ],
      rows: data.paymentHistory.map((p) => ({
        date: formatDate(p.receivedDate),
        dueDate: p.dueDate ? formatDate(p.dueDate) : "—",
        method: p.paymentMethod,
        amount: formatCents(p.amountCents),
        status: p.status,
      })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="statement-of-account-${data.contractNumber}.xlsx"`,
    },
  });
}
