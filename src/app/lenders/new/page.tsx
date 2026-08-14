"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { addLender, type AddLenderState } from "./actions";

export default function AddLenderPage() {
  const [state, formAction, pending] = useActionState<AddLenderState | undefined, FormData>(addLender, undefined);
  const [partyType, setPartyType] = useState<"BUSINESS" | "INDIVIDUAL">("BUSINESS");

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/lenders" className="text-sm font-medium text-blue-700 hover:underline">
        ← All Lenders
      </Link>
      <h1 className="mb-6 mt-2 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <UserPlus size={20} className="text-slate-400" aria-hidden="true" />
        Add New Lender
      </h1>

      <form action={formAction} className="space-y-4 rounded-lg border border-slate-200 shadow-sm bg-white p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="partyType"
                value="BUSINESS"
                checked={partyType === "BUSINESS"}
                onChange={() => setPartyType("BUSINESS")}
              />
              Business
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="partyType"
                value="INDIVIDUAL"
                checked={partyType === "INDIVIDUAL"}
                onChange={() => setPartyType("INDIVIDUAL")}
              />
              Individual
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="displayName">
            {partyType === "INDIVIDUAL" ? "Full Name" : "Company Name"}
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {partyType === "INDIVIDUAL" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="firstName">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="lastName">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <input type="hidden" name="companyName" value="" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mailingAddressLine1">
            Mailing Address
          </label>
          <input
            id="mailingAddressLine1"
            name="mailingAddressLine1"
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mailingCity">
              City
            </label>
            <input
              id="mailingCity"
              name="mailingCity"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mailingState">
              State
            </label>
            <input
              id="mailingState"
              name="mailingState"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="mailingZip">
              Zip
            </label>
            <input
              id="mailingZip"
              name="mailingZip"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="portalPin">
              Portal PIN
            </label>
            <input
              id="portalPin"
              name="portalPin"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="preferredPaymentMethod">
              Preferred Payment Method
            </label>
            <select
              id="preferredPaymentMethod"
              name="preferredPaymentMethod"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Check (default)</option>
              <option value="CHECK">Check</option>
              <option value="ACH">ACH</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">SSN/TIN &amp; ACH Banking</h2>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="taxId">
              EIN / TIN (or SSN)
            </label>
            <input
              id="taxId"
              name="taxId"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="achBankName">
                Bank Name
              </label>
              <input
                id="achBankName"
                name="achBankName"
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="achRoutingNumber">
                Routing Number
              </label>
              <input
                id="achRoutingNumber"
                name="achRoutingNumber"
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="achAccountNumber">
              Account Number
            </label>
            <input
              id="achAccountNumber"
              name="achAccountNumber"
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Add Lender"}
        </button>
      </form>
    </main>
  );
}
