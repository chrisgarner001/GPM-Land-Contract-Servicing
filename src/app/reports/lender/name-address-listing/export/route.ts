import { NextResponse } from "next/server";
import { getLenderNameAddressListing } from "@/server/lenderReports";
import { buildExcelWorkbook } from "@/lib/excel";

export async function GET() {
  const rows = await getLenderNameAddressListing();

  const buffer = await buildExcelWorkbook([
    {
      name: "Name & Address Listing",
      columns: [
        { header: "Name", key: "displayName", width: 28 },
        { header: "Phone", key: "phone", width: 16 },
        { header: "Address Line 1", key: "mailingAddressLine1", width: 24 },
        { header: "City", key: "mailingCity", width: 16 },
        { header: "State", key: "mailingState", width: 8 },
        { header: "Zip", key: "mailingZip", width: 10 },
      ],
      rows: rows.map((r) => ({ ...r, phone: r.phone ?? "" })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lender-name-address-listing.xlsx"`,
    },
  });
}
