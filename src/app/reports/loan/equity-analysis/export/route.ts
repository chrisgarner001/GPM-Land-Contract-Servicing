import { NextResponse } from "next/server";
import { getEquityAnalysis, DEFAULT_EQUITY_THRESHOLD_PERCENT } from "@/server/loanReports";
import { buildExcelWorkbook } from "@/lib/excel";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qualifyingOnly = searchParams.get("qualifyingOnly") !== "0";
  const rawThreshold = searchParams.get("thresholdPercent");
  const thresholdPercent = rawThreshold && Number.isFinite(Number(rawThreshold)) ? Number(rawThreshold) : DEFAULT_EQUITY_THRESHOLD_PERCENT;

  const allRows = await getEquityAnalysis(thresholdPercent);
  const rows = qualifyingOnly ? allRows.filter((r) => r.qualifies) : allRows;

  const buffer = await buildExcelWorkbook([
    {
      name: "Equity Analysis",
      columns: [
        { header: "Contract #", key: "contractNumber", width: 16 },
        { header: "Lender", key: "lenderName", width: 24 },
        { header: "Borrower", key: "borrowerName", width: 28 },
        { header: "Email", key: "borrowerEmail", width: 28 },
        { header: "Phone", key: "borrowerPhone", width: 16 },
        { header: "Property Address", key: "propertyAddress", width: 36 },
        { header: "County", key: "county", width: 14 },
        { header: "LC Balance", key: "balanceDollars", width: 14 },
        { header: "Market Value", key: "marketValueDollars", width: 14 },
        { header: "Equity", key: "equityDollars", width: 14 },
        { header: "Equity %", key: "equityPercent", width: 10 },
        { header: `Qualifies (${thresholdPercent}%+)`, key: "qualifies", width: 16 },
        { header: "Data As Of", key: "assessorFetchedAt", width: 14 },
      ],
      rows: rows.map((r) => ({
        contractNumber: r.contractNumber,
        lenderName: r.lenderName ?? "",
        borrowerName: r.borrowerName ?? "",
        borrowerEmail: r.borrowerEmail ?? "",
        borrowerPhone: r.borrowerPhone ?? "",
        propertyAddress: r.propertyAddress,
        county: r.county,
        balanceDollars: r.currentPrincipalBalanceCents / 100,
        marketValueDollars: r.estimatedMarketValueCents !== null ? r.estimatedMarketValueCents / 100 : "",
        equityDollars: r.equityCents !== null ? r.equityCents / 100 : "",
        equityPercent: r.equityPercent !== null ? Number(r.equityPercent.toFixed(1)) : "",
        qualifies: r.qualifies ? "Yes" : "No",
        assessorFetchedAt: r.assessorFetchedAt ? r.assessorFetchedAt.slice(0, 10) : "",
      })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="land-contract-equity-analysis.xlsx"`,
    },
  });
}
