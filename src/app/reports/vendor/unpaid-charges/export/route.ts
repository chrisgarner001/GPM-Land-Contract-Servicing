import { NextRequest, NextResponse } from "next/server";
import { getVendorOptions, getVendorUnpaidCharges } from "@/server/vendorReports";
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
  const data = await getVendorUnpaidCharges(vendorIds, startDate, endDate);

  const rows = data.flatMap((d) =>
    d.rows.map((r) => ({
      vendor: vendorsById.get(d.vendorId) ?? "Unknown",
      glCode: r.glCode ?? "—",
      contractNumber: r.contractNumber ?? "—",
      dueDate: formatDate(r.dueDate),
      amount: formatCents(r.amountCents),
      paymentMethod: r.paymentMethod,
    }))
  );

  const buffer = await buildExcelWorkbook([
    {
      name: "Vendor Unpaid Charges",
      columns: [
        { header: "Vendor", key: "vendor", width: 22 },
        { header: "GL Code", key: "glCode", width: 12 },
        { header: "Land Contract", key: "contractNumber", width: 16 },
        { header: "Due Date", key: "dueDate", width: 12 },
        { header: "Amount", key: "amount", width: 14 },
        { header: "Payment Type", key: "paymentMethod", width: 14 },
      ],
      rows,
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vendor-unpaid-charges.xlsx"`,
    },
  });
}
