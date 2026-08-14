import { NextRequest, NextResponse } from "next/server";
import { getCheckRegisterData } from "@/server/accountingReports";
import { buildExcelWorkbook } from "@/lib/excel";
import { formatCents, formatDate } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bankAccountFilter = searchParams.get("bankAccount") || "ALL";
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing startDate/endDate." }, { status: 400 });
  }

  const data = await getCheckRegisterData(bankAccountFilter, startDate, endDate);

  const buffer = await buildExcelWorkbook([
    {
      name: "Check Register",
      columns: [
        { header: "Date", key: "date", width: 12 },
        { header: "Check #", key: "checkNumber", width: 14 },
        { header: "Payee", key: "payee", width: 32 },
        { header: "Method", key: "method", width: 10 },
        { header: "Amount", key: "amount", width: 16 },
      ],
      rows: [
        ...data.rows.map((r) => ({
          date: formatDate(r.checkDate),
          checkNumber: r.checkNumber,
          payee: `${r.payeeName} (${r.payeeCode})`,
          method: r.paymentMethod,
          amount: formatCents(r.totalAmountCents),
        })),
        { date: "", checkNumber: "", payee: "", method: "Total", amount: formatCents(data.totalCents) },
      ],
    },
  ]);

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="check-register-${data.bankAccountLabel.toLowerCase().replace(/\s+/g, "-")}.xlsx"`,
    },
  });
}
