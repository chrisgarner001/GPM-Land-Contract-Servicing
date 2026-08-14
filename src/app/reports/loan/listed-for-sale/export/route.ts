import { NextResponse } from "next/server";
import { getListedForSaleProperties, LOAN_TYPE_LABELS } from "@/server/loanReports";
import { buildExcelWorkbook } from "@/lib/excel";

export async function GET() {
  const rows = await getListedForSaleProperties();

  const buffer = await buildExcelWorkbook([
    {
      name: "Listed For Sale",
      columns: [
        { header: "Contract #", key: "contractNumber", width: 16 },
        { header: "Loan Type", key: "loanType", width: 14 },
        { header: "Lender", key: "lenderName", width: 24 },
        { header: "Borrower", key: "borrowerName", width: 28 },
        { header: "Property Address", key: "propertyAddress", width: 36 },
        { header: "County", key: "county", width: 14 },
        { header: "Balance", key: "balanceDollars", width: 14 },
        { header: "Listed Date", key: "isListedDate", width: 14 },
        { header: "Data As Of", key: "assessorFetchedAt", width: 14 },
      ],
      rows: rows.map((r) => ({
        contractNumber: r.contractNumber,
        loanType: LOAN_TYPE_LABELS[r.loanType] ?? r.loanType,
        lenderName: r.lenderName ?? "",
        borrowerName: r.borrowerName ?? "",
        propertyAddress: r.propertyAddress,
        county: r.county,
        balanceDollars: r.currentPrincipalBalanceCents / 100,
        isListedDate: r.isListedDate ?? "",
        assessorFetchedAt: r.assessorFetchedAt.slice(0, 10),
      })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="properties-listed-for-sale.xlsx"`,
    },
  });
}
