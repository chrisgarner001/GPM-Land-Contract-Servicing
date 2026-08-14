import { NextResponse } from "next/server";
import { getVendorNameAddressListing } from "@/server/vendorReports";
import { buildExcelWorkbook } from "@/lib/excel";

export async function GET() {
  const rows = await getVendorNameAddressListing();

  const buffer = await buildExcelWorkbook([
    {
      name: "Name & Address Listing",
      columns: [
        { header: "Name", key: "displayName", width: 28 },
        { header: "Account Code", key: "vendorAccountCode", width: 16 },
        { header: "Email", key: "email", width: 24 },
        { header: "Address Line 1", key: "addressLine1", width: 24 },
        { header: "City/State/Zip", key: "cityStateZip", width: 24 },
      ],
      rows: rows.map((r) => ({ ...r, email: r.email ?? "", addressLine1: r.addressLine1 ?? "", cityStateZip: r.cityStateZip ?? "" })),
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vendor-name-address-listing.xlsx"`,
    },
  });
}
