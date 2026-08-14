import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import type { Answers } from "./answers";
import { isoToDisplay } from "@/domain/documents/isoDateFormat";
import { buildDocxRenderData, dollarsToCents, formatMoney } from "./renderData";

const TEMPLATES_DIR = path.join(process.cwd(), "src", "document-templates", "land-contract-package");

// Display name (used for the output filename) -> template filename. All 10
// share the same {tag} vocabulary (see renderData.ts), so one render-data
// object feeds every one of them. No Affiliated Business Disclosure here —
// that document discloses a specific real attorney/ownership relationship
// SGMS has and this deployment doesn't; add one back only if this company
// has an analogous relationship to disclose.
const DOCX_TEMPLATES: { label: string; file: string }[] = [
  { label: "Land Contract", file: "LandContract Template .docx" },
  { label: "Promissory Note", file: "Note.docx" },
  { label: "Payment Statement", file: "Payment Statement.docx" },
  { label: "Compliance Agreement", file: "Compliance Agreement.docx" },
  { label: "Affidavit of Continuing Responsibility", file: "ACR.docx" },
  { label: "Acknowledgement of No Legal Advice", file: "No Legal.docx" },
  { label: "Acknowledgement of Utility Transfer", file: "Acknowledgement of Utilities.docx" },
  { label: "Borrower Certifications", file: "Borrower Certifications.docx" },
  { label: "Buyer Contact Information", file: "Buyer Contact Information.docx" },
  { label: "Waiver of Sellers Disclosure Statement", file: "Waiver of Seller's Disclosure Statement.docx" },
];

export interface GeneratedFile {
  filename: string;
  buffer: Buffer;
}

function renderDocx(templateFile: string, renderData: Record<string, string>): Buffer {
  const zip = new PizZip(fs.readFileSync(path.join(TEMPLATES_DIR, templateFile)));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(renderData);
  return doc.getZip().generate({ type: "nodebuffer" });
}

async function renderClosingStatement(a: Answers): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(TEMPLATES_DIR, "Closing Statement.xlsx"));
  const sheet = wb.getWorksheet(1)!;

  const dollars = (v: string | undefined) => dollarsToCents(v) / 100;
  sheet.getCell("D10").value = dollars(a.purchase_price);
  sheet.getCell("E11").value = dollars(a.earnest_money_deposit);
  sheet.getCell("D14").value = dollars(a.property_tax_proration);
  sheet.getCell("D15").value = dollars(a.insurance_proration);
  sheet.getCell("D16").value = dollars(a.city_property_tax_proration);
  sheet.getCell("E17").value = dollars(a.original_principal);
  sheet.getCell("A20").value = dollars(a.buyer_broker_commission);
  sheet.getCell("A21").value = dollars(a.listing_broker_commission);
  sheet.getCell("D24").value = dollars(a.loan_origination_fee);
  sheet.getCell("D25").value = dollars(a.annual_insurance_premium);
  sheet.getCell("D26").value = dollars(a.prepaid_interest);
  sheet.getCell("D28").value = dollars(a.city_taxes_paid_by_seller);
  sheet.getCell("D29").value = dollars(a.county_taxes_paid_by_seller);

  const propertyAddress = [a.property_street, a.property_city, [a.property_state, a.property_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  function substitute(address: string, replacements: Record<string, string>) {
    const cell = sheet.getCell(address);
    const applyTo = (text: string) => {
      let out = text;
      for (const [tag, value] of Object.entries(replacements)) out = out.split(`{${tag}}`).join(value);
      return out;
    };
    const value = cell.value;
    if (value && typeof value === "object" && "richText" in value) {
      const richText = (value as { richText: ExcelJS.RichText[] }).richText;
      cell.value = { richText: richText.map((run) => ({ ...run, text: applyTo(run.text) })) };
    } else if (typeof value === "string") {
      cell.value = applyTo(value);
    }
  }

  const tokens = {
    buyer_name: a.buyer_name ?? "",
    seller_name: a.seller_name ?? "",
    seller_signatory_name: a.seller_signatory_name ?? "",
    property_address: propertyAddress,
    closing_date: a.closing_date ? isoToDisplay(a.closing_date) : "",
    buyer_broker_name: a.buyer_broker_name ?? "",
    listing_broker_name: a.listing_broker_name ?? "",
  };
  for (const addr of ["C2", "C3", "C4", "C5", "C20", "C21", "C40", "C45"]) substitute(addr, tokens);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function mmddyyyy(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

async function renderPre(a: Answers): Promise<Buffer> {
  const bytes = fs.readFileSync(path.join(TEMPLATES_DIR, "PRE.pdf"));
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  const propertyAddress = [a.property_street, a.property_city, [a.property_state, a.property_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const setText = (name: string, value: string) => {
    try {
      form.getTextField(name).setText(value);
    } catch {
      // field not present / not a text field — skip rather than throw
    }
  };

  setText("Property ID Number", a.parcel_id ?? "");
  setText("Local Unit", a.municipality_name ?? "");
  setText("County", a.property_county ?? "");
  setText("Street Address", propertyAddress);
  setText("Name", a.buyer_name ?? "");
  setText("Co Owner", a.co_buyer_name ?? "");
  setText("SSN", a.buyer_ssn_last4 ?? "");
  setText("SSN1", a.co_buyer_ssn_last4 ?? "");
  setText("Number", a.buyer_phone ?? "");
  setText("Date", mmddyyyy(a.closing_date));
  setText("Percentage", a.occupancy_percent ?? "");

  // Only the one unambiguous checkbox — see generatePackage.ts's module
  // comment. Line 11a "Principal residence" is the near-universal case for
  // this business's buyers; every other checkbox is left for a manual check
  // before filing.
  if (a.occupancy_type === "PRIMARY") {
    try {
      form.getCheckBox("Check Box2.undefined").check();
    } catch {
      /* field not present */
    }
  }

  const outBytes = await pdf.save();
  return Buffer.from(outBytes);
}

async function renderPta(a: Answers): Promise<Buffer> {
  const bytes = fs.readFileSync(path.join(TEMPLATES_DIR, "PTA.pdf"));
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  const propertyAddress = [a.property_street, a.property_city, [a.property_state, a.property_zip].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  const stripDollar = (v: string | undefined) => (dollarsToCents(v) / 100).toFixed(2);

  const setText = (name: string, value: string) => {
    try {
      form.getTextField(name).setText(value);
    } catch {
      /* field not present / not a text field */
    }
  };

  setText("street address of property", propertyAddress);
  setText("county", a.property_county ?? "");
  setText("date of transfer", mmddyyyy(a.closing_date));
  setText("purchase price of RE", stripDollar(a.purchase_price));
  setText("location of real estate", a.municipality_name ?? "");
  setText("sellers name", a.seller_name ?? "");
  setText("pin", a.parcel_id ?? "");
  setText("buyers name and address", [a.buyer_name, a.buyer_address].filter(Boolean).join(", "));
  setText("buyer's phone number", a.buyer_phone ?? "");
  setText("amount of down payment", stripDollar(a.down_payment));
  setText("amount financed", stripDollar(a.original_principal));
  // Filed by the buyer/transferee per the form's own instructions (MCL 211.27a(10)).
  setText("Printed Name", a.buyer_name ?? "");
  setText("date of signature", mmddyyyy(a.closing_date));
  setText("signer daytime phone", a.buyer_phone ?? "");
  setText("email address", a.buyer_email ?? "");

  // The one unambiguous checkbox — "Type of Transfer: Land Contract" is
  // true for every package this app generates. City/Township/Village and
  // every Yes/No/exemption checkbox are left blank; see module comment.
  try {
    form.getCheckBox("type of transfer check").check();
  } catch {
    /* field not present */
  }

  const outBytes = await pdf.save();
  return Buffer.from(outBytes);
}

function slug(value: string, fallback: string): string {
  return (value?.trim() || fallback).replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
}

// Generates all 14 files for a package. PRE/PTA auto-fill every text field
// but only the one unambiguous checkbox on each (see renderPre/renderPta) —
// the rest need a quick manual check before filing.
export async function generateAllFiles(a: Answers): Promise<GeneratedFile[]> {
  const renderData = buildDocxRenderData(a);
  const buyerSlug = slug(a.buyer_name ?? "", "Buyer");
  const propertySlug = slug(a.property_street ?? "", "Property");
  const prefix = `${buyerSlug}-${propertySlug}`;

  const files: GeneratedFile[] = [];

  for (const t of DOCX_TEMPLATES) {
    files.push({ filename: `${prefix}-${slug(t.label, t.label)}.docx`, buffer: renderDocx(t.file, renderData) });
  }
  files.push({ filename: `${prefix}-Closing-Statement.xlsx`, buffer: await renderClosingStatement(a) });
  files.push({ filename: `${prefix}-PRE-Affidavit.pdf`, buffer: await renderPre(a) });
  files.push({ filename: `${prefix}-Property-Transfer-Affidavit.pdf`, buffer: await renderPta(a) });

  return files;
}

export { formatMoney };
