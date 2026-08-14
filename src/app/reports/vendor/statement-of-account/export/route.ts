import { NextRequest, NextResponse } from "next/server";
import { getVendorOptions, getVendorStatementOfAccount } from "@/server/vendorReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendorIds = searchParams.getAll("vendorIds");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (vendorIds.length === 0 || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing vendorIds/startDate/endDate." }, { status: 400 });
  }

  const vendorOptions = await getVendorOptions();
  const vendorsById = new Map(vendorOptions.map((v) => [v.id, v.displayName]));
  const statements = await getVendorStatementOfAccount(vendorIds, startDate, endDate);

  const rows = statements.flatMap((s) =>
    s.lines.map((l) => ({
      vendor: vendorsById.get(s.vendorId) ?? "Unknown",
      date: formatDate(l.transactionDate),
      contractNumber: l.contractNumber ?? "—",
      glCode: l.glCode ?? "—",
      reference: l.reference ?? "—",
      amount: formatCents(l.amountCents),
      chargedToLender: l.chargedToLenderCents ? formatCents(l.chargedToLenderCents) : "—",
      chargedToBorrower: l.chargedToBorrowerCents ? formatCents(l.chargedToBorrowerCents) : "—",
      checkNumber: l.checkNumber ?? "—",
      checkDate: l.checkDate ? formatDate(l.checkDate) : "—",
    }))
  );

  const buffer = await buildExcelWorkbook([
    {
      name: "Vendor Statement of Account",
      columns: [
        { header: "Vendor", key: "vendor", width: 22 },
        { header: "Date", key: "date", width: 12 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "GL Code", key: "glCode", width: 12 },
        { header: "Reference", key: "reference", width: 18 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Charged to Lender", key: "chargedToLender", width: 16 },
        { header: "Charged to Borrower", key: "chargedToBorrower", width: 16 },
        { header: "Check #", key: "checkNumber", width: 14 },
        { header: "Check Date", key: "checkDate", width: 12 },
      ],
      rows,
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vendor-statement-of-account.xlsx"`,
    },
  });
}
