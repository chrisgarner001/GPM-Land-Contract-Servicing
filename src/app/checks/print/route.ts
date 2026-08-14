import { NextRequest, NextResponse } from "next/server";
import { getCheckPrintData } from "@/server/printChecks";
import { buildCheckPdf } from "@/lib/checkPdf";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Missing ids." }, { status: 400 });
  }

  const data = await getCheckPrintData(ids);
  const pdfBytes = await buildCheckPdf(data);

  return new NextResponse(pdfBytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="checks.pdf"`,
    },
  });
}
