import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}

// Generic — any report's tabular data fits this shape, so every report's
// export/route.ts just maps its own query result into { name, columns, rows }
// rather than each hand-rolling ExcelJS setup.
//
// Callers pass the result to `new NextResponse(buffer as BodyInit, ...)` —
// the cast is needed because TS's lib.dom types this Uint8Array's backing
// buffer as ArrayBufferLike (which includes SharedArrayBuffer) rather than
// plain ArrayBuffer, which BodyInit's strict typing rejects even though a
// real Uint8Array body works fine at runtime in every JS engine.
export async function buildExcelWorkbook(sheets: ExcelSheet[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.addRows(sheet.rows);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}
