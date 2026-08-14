"use client";

import { useActionState } from "react";
import { updateLenderContact, type UpdateLenderContactState } from "../actions";

export default function ContactInfoSection({
  lenderId,
  firstName,
  lastName,
  companyName,
  email,
  phone,
  mailingAddressLine1,
  mailingAddressLine2,
  mailingCity,
  mailingState,
  mailingZip,
}: {
  lenderId: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  mailingAddressLine1: string | null;
  mailingAddressLine2: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
}) {
  const action = updateLenderContact.bind(null, lenderId);
  const [state, formAction, pending] = useActionState<UpdateLenderContactState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contact Information</h3>
      <form action={formAction} className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="firstName">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            defaultValue={firstName ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="lastName">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            defaultValue={lastName ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="companyName">
            Company Name
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            defaultValue={companyName ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            defaultValue={phone ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mailingAddressLine1">
            Mailing Address Line 1
          </label>
          <input
            id="mailingAddressLine1"
            name="mailingAddressLine1"
            type="text"
            defaultValue={mailingAddressLine1 ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mailingAddressLine2">
            Mailing Address Line 2
          </label>
          <input
            id="mailingAddressLine2"
            name="mailingAddressLine2"
            type="text"
            defaultValue={mailingAddressLine2 ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mailingCity">
            City
          </label>
          <input
            id="mailingCity"
            name="mailingCity"
            type="text"
            defaultValue={mailingCity ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="mailingState">
              State
            </label>
            <input
              id="mailingState"
              name="mailingState"
              type="text"
              defaultValue={mailingState ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="mailingZip">
              Zip
            </label>
            <input
              id="mailingZip"
              name="mailingZip"
              type="text"
              defaultValue={mailingZip ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-between">
          {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
