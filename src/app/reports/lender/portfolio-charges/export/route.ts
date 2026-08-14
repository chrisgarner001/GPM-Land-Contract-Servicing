import { NextRequest, NextResponse } from "next/server";
import { getPortfolioChargesData, getLenderOptions } from "@/server/lenderReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate } from "@/lib/format";

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
  const statements = await getPortfolioChargesData(lenderIds, startDate, endDate);

  const rows = statements.flatMap((s) =>
    s.rows.map((r) => ({
      lender: lendersById.get(s.lenderId) ?? "Unknown",
      date: formatDate(r.transactionDate),
      contractNumber: r.contractNumber ?? "",
      description: r.description ?? "",
      amount: formatCents(r.amountPaidOutCents),
      alsoChargedToBorrower: r.alsoChargedToBorrower ? `Yes (${formatCents(r.borrowerRemainingCents)} remaining)` : "No",
    }))
  );

  const buffer = await buildExcelWorkbook([
    {
      name: "Portfolio Charges",
      columns: [
        { header: "Lender", key: "lender", width: 22 },
        { header: "Date", key: "date", width: 14 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Description", key: "description", width: 30 },
        { header: "Amount", key: "amount", width: 16 },
        { header: "Also Charged to Borrower", key: "alsoChargedToBorrower", width: 26 },
      ],
      rows,
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="portfolio-charges.xlsx"`,
    },
  });
}
