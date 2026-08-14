import { pgTable, uuid, text, timestamp, pgEnum, boolean, date, bigint } from "drizzle-orm/pg-core";
import { bankAccounts } from "./setup";
import { vendors } from "./vendors";

export const partyTypeEnum = pgEnum("party_type", ["INDIVIDUAL", "BUSINESS"]);

export const preferredPaymentMethodEnum = pgEnum("preferred_payment_method", ["CHECK", "ACH"]);

export const emailFormatEnum = pgEnum("email_format", ["HTML", "TEXT"]);

export const tinTypeEnum = pgEnum("tin_type", ["SSN", "EIN"]);

export const propertyTypeEnum = pgEnum("property_type", ["SINGLE_FAMILY", "MULTI_FAMILY", "COMMERCIAL", "OTHER"]);

export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyType: partyTypeEnum("party_type").notNull(),
  displayName: text("display_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  mailingAddressLine1: text("mailing_address_line1"),
  mailingAddressLine2: text("mailing_address_line2"),
  mailingCity: text("mailing_city"),
  mailingState: text("mailing_state"),
  mailingZip: text("mailing_zip"),
  mailingCountry: text("mailing_country"),
  // Borrower Contact Info section — modeled on TMO's own "General" tab.
  // Party-generic fields (not restricted to borrowers), just not yet
  // surfaced on the Lenders detail page.
  salutation: text("salutation"),
  middleInitial: text("middle_initial"),
  phoneHome: text("phone_home"),
  phoneWork: text("phone_work"),
  phoneMobile: text("phone_mobile"),
  phoneFax: text("phone_fax"),
  emailFormat: emailFormatEnum("email_format"),
  // Delivery preference checkboxes from TMO — stored for record-keeping;
  // not yet wired to any automated notice/statement/SMS-sending behavior,
  // since none exists in this app today.
  deliveryByPrint: boolean("delivery_by_print").notNull().default(false),
  deliveryByEmail: boolean("delivery_by_email").notNull().default(false),
  deliveryBySms: boolean("delivery_by_sms").notNull().default(false),
  legalStructure: text("legal_structure"),
  dateOfBirth: date("date_of_birth"),
  // TIN itself is taxIdEncrypted/taxIdLast4 below (existing) — this is just
  // which kind of TIN it is.
  tinType: tinTypeEnum("tin_type"),
  // TMO's "Hold" checkbox, adjacent to TIN/TIN Type in its own UI — likely
  // an IRS backup-withholding hold, but stored generically since nothing
  // in this app currently acts on it.
  onHold: boolean("on_hold").notNull().default(false),
  alternateTaxInfo: text("alternate_tax_info"),
  // Notices & Forms checkboxes from TMO — same inert-for-now status as the
  // delivery preferences above; sendTaxReporting is the most likely to
  // eventually connect to the (currently stub) Tax Forms feature.
  sendTaxReporting: boolean("send_tax_reporting").notNull().default(false),
  sendLateNotices: boolean("send_late_notices").notNull().default(false),
  sendPaymentReceipts: boolean("send_payment_receipts").notNull().default(false),
  sendPaymentStatements: boolean("send_payment_statements").notNull().default(false),
  taxIdLast4: text("tax_id_last4"),
  // Full SSN/TIN — AES-256-GCM encrypted (see lib/encryption.ts), never
  // stored or logged in plaintext. taxIdLast4 above stays as the
  // quick-display masked value so list views don't need to decrypt.
  taxIdEncrypted: text("tax_id_encrypted"),
  achBankName: text("ach_bank_name"),
  // Routing numbers are public bank identifiers (printed on every check),
  // not sensitive on their own — only the account number needs encryption.
  achRoutingNumber: text("ach_routing_number"),
  achAccountLast4: text("ach_account_last4"),
  achAccountNumberEncrypted: text("ach_account_number_encrypted"),
  googleDriveFolderUrl: text("google_drive_folder_url"),
  notes: text("notes"),
  // Online-portal login PIN — confirmed live in TMO's own lender/borrower
  // portal exports. For borrowers this lives on `contracts` instead (their
  // portal access is keyed by loan account, shared across co-buyers); for
  // lenders it belongs here since each lender party has exactly one PIN.
  portalPin: text("portal_pin"),
  // Lenders only — set only by a genuine self-service login (email+PIN via
  // /online-portals/lenders), never by staff's own Log In As impersonation.
  portalLastLoginAt: timestamp("portal_last_login_at", { withTimezone: true }),
  // Lenders only — actually enforced: blocks both self-service login and
  // staff Log In As until reactivated (see lenderLoginAction/
  // logInAsLenderAction).
  portalDeactivated: boolean("portal_deactivated").notNull().default(false),
  // Lenders only — Check vs. ACH, defaulted to Check when unset. Overridable
  // per Lender Payment Run; this is just the pre-selected default.
  preferredPaymentMethod: preferredPaymentMethodEnum("preferred_payment_method"),
  // Lenders only — which of the business's own bank accounts (Setup > Bank
  // Accounts) this lender is normally paid from. Effectively always the
  // Owner Trust account, but kept selectable rather than hardcoded.
  defaultBankAccountId: uuid("default_bank_account_id").references(() => bankAccounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  streetAddress: text("street_address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  county: text("county").notNull(),
  parcelNumber: text("parcel_number"),
  legalDescription: text("legal_description"),
  propertyType: propertyTypeEnum("property_type").default("SINGLE_FAMILY"),
  // Staff-entered estimated/appraised value — distinct from a contract's
  // purchasePriceCents (the actual sale price at origination); this can be
  // updated independently over time and isn't tied to any one contract.
  // No automated Zillow/Redfin lookup feeds this — both block automated
  // fetches (confirmed directly, 403) and neither offers a free public API
  // anymore (Zillow retired its public API in 2021; a real Zestimate needs
  // either an approved MLS/IDX partner account or a paid third-party data
  // provider) — staff enter/update this by hand.
  estimatedValueCents: bigint("estimated_value_cents", { mode: "number" }),
  // Superseded by insuranceCarrierVendorId (a real link into the Vendors
  // list, so an invoice against this carrier can be posted directly) — kept,
  // unused, since nothing had been entered into it yet.
  insuranceCarrier: text("insurance_carrier"),
  insuranceCarrierVendorId: uuid("insurance_carrier_vendor_id").references(() => vendors.id),
  insuranceLastBillAmountCents: bigint("insurance_last_bill_amount_cents", { mode: "number" }),
  insuranceLastBillDate: date("insurance_last_bill_date"),
  // Winter/Summer are the two property-tax installment bills (the common
  // convention where this business operates) — tracked separately since
  // they're issued by different taxing authorities on different schedules.
  winterTaxLastBillAmountCents: bigint("winter_tax_last_bill_amount_cents", { mode: "number" }),
  winterTaxLastBillDate: date("winter_tax_last_bill_date"),
  summerTaxLastBillAmountCents: bigint("summer_tax_last_bill_amount_cents", { mode: "number" }),
  summerTaxLastBillDate: date("summer_tax_last_bill_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
