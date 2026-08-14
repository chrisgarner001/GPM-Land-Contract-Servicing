import { NextRequest, NextResponse } from "next/server";
import { getAccruedInterestData, getLenderOptions } from "@/server/lenderReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatPercent } from "@/lib/format";

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
  const statements = await getAccruedInterestData(lenderIds, startDate, endDate);

  const rows = statements.flatMap((s) =>
    s.holdings.map((h) => ({
      lender: lendersById.get(s.lenderId) ?? "Unknown",
      contractNumber: h.contractNumber,
      borrower: h.borrowerName,
      ownership: formatPercent(h.ownershipPercent),
      rate: formatPercent(h.interestRateAnnual),
      principalBalance: formatCents(h.principalBalanceCents),
      days: h.days,
      accruedInterest: formatCents(h.accruedInterestCents),
    }))
  );

  const buffer = await buildExcelWorkbook([
    {
      name: "Accrued Interest",
      columns: [
        { header: "Lender", key: "lender", width: 22 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Borrower", key: "borrower", width: 22 },
        { header: "Ownership %", key: "ownership", width: 12 },
        { header: "Rate", key: "rate", width: 10 },
        { header: "Principal Balance", key: "principalBalance", width: 16 },
        { header: "Days", key: "days", width: 8 },
        { header: "Accrued Interest", key: "accruedInterest", width: 16 },
      ],
      rows,
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="accrued-interest.xlsx"`,
    },
  });
}
