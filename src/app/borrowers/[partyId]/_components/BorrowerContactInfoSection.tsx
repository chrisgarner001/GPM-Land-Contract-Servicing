"use client";

import { useActionState } from "react";
import { updateBorrowerContactInfo, type UpdateBorrowerContactInfoState } from "../actions";

export default function BorrowerContactInfoSection({
  partyId,
  salutation,
  firstName,
  middleInitial,
  lastName,
  email,
  emailFormat,
  phoneHome,
  phoneWork,
  phoneMobile,
  phoneFax,
  mailingAddressLine1,
  mailingAddressLine2,
  mailingCity,
  mailingState,
  mailingZip,
  mailingCountry,
  deliveryByPrint,
  deliveryByEmail,
  deliveryBySms,
}: {
  partyId: string;
  salutation: string | null;
  firstName: string | null;
  middleInitial: string | null;
  lastName: string | null;
  email: string | null;
  emailFormat: "HTML" | "TEXT" | null;
  phoneHome: string | null;
  phoneWork: string | null;
  phoneMobile: string | null;
  phoneFax: string | null;
  mailingAddressLine1: string | null;
  mailingAddressLine2: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  mailingCountry: string | null;
  deliveryByPrint: boolean;
  deliveryByEmail: boolean;
  deliveryBySms: boolean;
}) {
  const action = updateBorrowerContactInfo.bind(null, partyId);
  const [state, formAction, pending] = useActionState<UpdateBorrowerContactInfoState | undefined, FormData>(action, undefined);

  return (
    <div className="rounded-lg border border-slate-200 shadow-sm p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Contact Information</h3>
      <form action={formAction} className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="salutation">
            Salutation
          </label>
          <input
            id="salutation"
            name="salutation"
            type="text"
            defaultValue={salutation ?? ""}
            placeholder="Mr., Mrs., Dr...."
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
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
          <div className="col-span-1">
            <label className="mb-1 block text-xs text-slate-500" htmlFor="middleInitial">
              MI
            </label>
            <input
              id="middleInitial"
              name="middleInitial"
              type="text"
              maxLength={1}
              defaultValue={middleInitial ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="col-span-1">
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
          <label className="mb-1 block text-xs text-slate-500" htmlFor="emailFormat">
            Email Format
          </label>
          <select
            id="emailFormat"
            name="emailFormat"
            defaultValue={emailFormat ?? "HTML"}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="HTML">HTML</option>
            <option value="TEXT">Text</option>
          </select>
        </div>

        <div className="col-span-2 grid grid-cols-4 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="phoneHome">
              Home
            </label>
            <input
              id="phoneHome"
              name="phoneHome"
              type="text"
              defaultValue={phoneHome ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="phoneWork">
              Work
            </label>
            <input
              id="phoneWork"
              name="phoneWork"
              type="text"
              defaultValue={phoneWork ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="phoneMobile">
              Mobile
            </label>
            <input
              id="phoneMobile"
              name="phoneMobile"
              type="text"
              defaultValue={phoneMobile ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500" htmlFor="phoneFax">
              Fax
            </label>
            <input
              id="phoneFax"
              name="phoneFax"
              type="text"
              defaultValue={phoneFax ?? ""}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
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
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500" htmlFor="mailingCountry">
            Country
          </label>
          <input
            id="mailingCountry"
            name="mailingCountry"
            type="text"
            defaultValue={mailingCountry ?? "United States"}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="col-span-2">
          <p className="mb-1 text-xs text-slate-500">Delivery Options</p>
          <div className="flex gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="deliveryByPrint" value="1" defaultChecked={deliveryByPrint} />
              Print
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="deliveryByEmail" value="1" defaultChecked={deliveryByEmail} />
              Email
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="deliveryBySms" value="1" defaultChecked={deliveryBySms} />
              SMS
            </label>
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
