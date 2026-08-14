"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePropertyAction, type UpdatePropertyState } from "../actions";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function centsToDollarString(cents: number | null): string {
  return cents !== null ? (cents / 100).toFixed(2) : "";
}

export default function PropertyDetailsSection({
  propertyId,
  streetAddress,
  city,
  state,
  zip,
  county,
  parcelNumber,
  propertyType,
  insuranceCarrierVendorId,
  vendorOptions,
  insuranceLastBillAmountCents,
  insuranceLastBillDate,
  winterTaxLastBillAmountCents,
  winterTaxLastBillDate,
  summerTaxLastBillAmountCents,
  summerTaxLastBillDate,
}: {
  propertyId: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  parcelNumber: string | null;
  propertyType: string | null;
  insuranceCarrierVendorId: string | null;
  vendorOptions: { id: string; displayName: string }[];
  insuranceLastBillAmountCents: number | null;
  insuranceLastBillDate: string | null;
  winterTaxLastBillAmountCents: number | null;
  winterTaxLastBillDate: string | null;
  summerTaxLastBillAmountCents: number | null;
  summerTaxLastBillDate: string | null;
}) {
  const action = updatePropertyAction.bind(null, propertyId);
  const [formState, formAction, pending] = useActionState<UpdatePropertyState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Property Details</h3>
      <form action={formAction} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor="streetAddress">
            Street Address
          </label>
          <input id="streetAddress" name="streetAddress" type="text" required defaultValue={streetAddress} className={inputClass} />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={labelClass} htmlFor="city">
              City
            </label>
            <input id="city" name="city" type="text" required defaultValue={city} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="state">
              State
            </label>
            <input id="state" name="state" type="text" required defaultValue={state} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="zip">
              Zip
            </label>
            <input id="zip" name="zip" type="text" required defaultValue={zip} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="county">
              County
            </label>
            <input id="county" name="county" type="text" required defaultValue={county} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="propertyType">
              Type
            </label>
            <select id="propertyType" name="propertyType" defaultValue={propertyType ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="SINGLE_FAMILY">SFR (Single Family Residential)</option>
              <option value="MULTI_FAMILY">Multi Family</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="parcelNumber">
            Parcel Number
          </label>
          <input id="parcelNumber" name="parcelNumber" type="text" defaultValue={parcelNumber ?? ""} className={inputClass} />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Insurance</h4>
          <div className="mb-1">
            <label className={labelClass} htmlFor="insuranceCarrierVendorId">
              Carrier
            </label>
            <select
              id="insuranceCarrierVendorId"
              name="insuranceCarrierVendorId"
              defaultValue={insuranceCarrierVendorId ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.displayName}
                </option>
              ))}
            </select>
            {insuranceCarrierVendorId && (
              <Link
                href={`/vendors/${insuranceCarrierVendorId}`}
                className="mt-1 inline-block text-xs text-blue-700 hover:underline"
              >
                View vendor →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="insuranceLastBillAmount">
                Last Bill Amount ($)
              </label>
              <input
                id="insuranceLastBillAmount"
                name="insuranceLastBillAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={centsToDollarString(insuranceLastBillAmountCents)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="insuranceLastBillDate">
                Last Bill Date
              </label>
              <input
                id="insuranceLastBillDate"
                name="insuranceLastBillDate"
                type="date"
                defaultValue={insuranceLastBillDate ?? ""}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Property Taxes</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="winterTaxLastBillAmount">
                Winter — Last Bill Amount ($)
              </label>
              <input
                id="winterTaxLastBillAmount"
                name="winterTaxLastBillAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={centsToDollarString(winterTaxLastBillAmountCents)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="winterTaxLastBillDate">
                Winter — Last Bill Date
              </label>
              <input
                id="winterTaxLastBillDate"
                name="winterTaxLastBillDate"
                type="date"
                defaultValue={winterTaxLastBillDate ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="summerTaxLastBillAmount">
                Summer — Last Bill Amount ($)
              </label>
              <input
                id="summerTaxLastBillAmount"
                name="summerTaxLastBillAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={centsToDollarString(summerTaxLastBillAmountCents)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="summerTaxLastBillDate">
                Summer — Last Bill Date
              </label>
              <input
                id="summerTaxLastBillDate"
                name="summerTaxLastBillDate"
                type="date"
                defaultValue={summerTaxLastBillDate ?? ""}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {formState?.error && <p className="text-sm text-red-600">{formState.error}</p>}
        {formState?.success && <p className="text-sm text-emerald-700">{formState.success}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
