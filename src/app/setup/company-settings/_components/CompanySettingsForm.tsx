"use client";

import { useActionState } from "react";
import type { CompanySettings } from "@/server/companySettings";
import { updateCompanySettingsAction, type UpdateCompanySettingsState } from "../actions";

const inputClass = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input id={name} name={name} type="text" defaultValue={defaultValue} className={inputClass} />
    </div>
  );
}

function centsToDollarString(cents: number | null): string {
  return cents !== null ? (cents / 100).toFixed(2) : "";
}

export default function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
  const action = updateCompanySettingsAction.bind(null, settings.id);
  const [state, formAction, pending] = useActionState<UpdateCompanySettingsState | undefined, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Company / Lender Identity
        </h3>
        <p className="mb-3 text-xs text-slate-400">Appears as the &quot;Lender&quot; entity on land contract packages.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="companyName" label="Company Name" defaultValue={settings.companyName} required />
          </div>
          <div className="sm:col-span-2">
            <Field name="companyAddressLine1" label="Address" defaultValue={settings.companyAddressLine1} />
          </div>
          <Field name="companyCity" label="City" defaultValue={settings.companyCity} />
          <Field name="companyState" label="State" defaultValue={settings.companyState} />
          <Field name="companyZip" label="Zip" defaultValue={settings.companyZip} />
          <Field name="companyNmlsId" label="NMLS ID" defaultValue={settings.companyNmlsId ?? ""} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Document Preparer / Attorney</h3>
        <p className="mb-3 text-xs text-slate-400">The &quot;This instrument was prepared by:&quot; block on deeds and closing packages.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="preparerFirmName" label="Firm Name" defaultValue={settings.preparerFirmName} required />
          </div>
          <Field name="preparerAttorneyName" label="Attorney Name" defaultValue={settings.preparerAttorneyName} />
          <Field name="titleFee" label="Title Settlement Fee ($)" defaultValue={centsToDollarString(settings.titleFeeCents)} />
          <div className="sm:col-span-2">
            <Field name="preparerAddressLine1" label="Address" defaultValue={settings.preparerAddressLine1} />
          </div>
          <Field name="preparerCity" label="City" defaultValue={settings.preparerCity} />
          <Field name="preparerState" label="State" defaultValue={settings.preparerState} />
          <Field name="preparerZip" label="Zip" defaultValue={settings.preparerZip} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Default Deed Contact</h3>
        <p className="mb-3 text-xs text-slate-400">
          Default Drafted By / Return To / Tax Bills To contact on the Deed Dashboard, when nothing else has been entered.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="defaultContactName" label="Name" defaultValue={settings.defaultContactName} />
          </div>
          <div className="sm:col-span-2">
            <Field name="defaultContactAddressLine1" label="Address" defaultValue={settings.defaultContactAddressLine1} />
          </div>
          <Field name="defaultContactCity" label="City" defaultValue={settings.defaultContactCity} />
          <Field name="defaultContactState" label="State" defaultValue={settings.defaultContactState} />
          <Field name="defaultContactZip" label="Zip" defaultValue={settings.defaultContactZip} />
          <Field name="defaultNotaryState" label="Default Notary State" defaultValue={settings.defaultNotaryState} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      </div>
    </form>
  );
}
