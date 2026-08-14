import { NextRequest, NextResponse } from "next/server";
import { getStatements } from "../page";
import { getLenderOptions } from "@/server/lenderReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate, formatPercent } from "@/lib/format";

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
  const statements = await getStatements(lenderIds, startDate, endDate);

  const portfolioRows = statements.flatMap((s) =>
    s.portfolio.map((p) => ({
      lender: lendersById.get(s.lenderId) ?? "Unknown",
      contractNumber: p.contractNumber,
      borrower: p.borrowerName,
      ownership: formatPercent(p.ownershipPercent),
      rate: formatPercent(p.interestRateAnnual),
      maturityDate: formatDate(p.maturityDate),
      nextPaymentDate: formatDate(p.nextPaymentDate),
      regularPayment: formatCents(p.paymentAmountCents),
      loanBalance: formatCents(p.currentPrincipalBalanceCents),
    }))
  );

  const fundingRows = statements.flatMap((s) =>
    s.funding.map((f) => ({
      lender: lendersById.get(s.lenderId) ?? "Unknown",
      date: formatDate(f.fundingDate),
      contractNumber: f.contractNumber,
      rate: formatPercent(f.interestRateAnnual),
      amountFunded: formatCents(f.fundedAmountCents),
    }))
  );

  const buffer = await buildExcelWorkbook([
    {
      name: "Investment Portfolio",
      columns: [
        { header: "Lender", key: "lender", width: 22 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Borrower", key: "borrower", width: 22 },
        { header: "Ownership %", key: "ownership", width: 12 },
        { header: "Rate", key: "rate", width: 10 },
        { header: "Maturity Date", key: "maturityDate", width: 14 },
        { header: "Next Payment", key: "nextPaymentDate", width: 14 },
        { header: "Regular Payment", key: "regularPayment", width: 16 },
        { header: "Loan Balance", key: "loanBalance", width: 16 },
      ],
      rows: portfolioRows,
    },
    {
      name: "Funding Activity",
      columns: [
        { header: "Lender", key: "lender", width: 22 },
        { header: "Date", key: "date", width: 14 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Rate", key: "rate", width: 10 },
        { header: "Amount Funded", key: "amountFunded", width: 16 },
      ],
      rows: fundingRows,
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lender-statement-of-account.xlsx"`,
    },
  });
}
