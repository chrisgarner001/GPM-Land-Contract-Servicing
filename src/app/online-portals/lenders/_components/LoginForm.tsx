"use client";

import { useActionState } from "react";
import CompanyLogo from "@/app/_components/CompanyLogo";
import { lenderLoginAction, type LenderLoginState } from "../actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LenderLoginState | undefined, FormData>(
    lenderLoginAction,
    undefined
  );

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <CompanyLogo className="mb-6 h-8" />
      <h1 className="text-lg font-semibold text-slate-900">Lender Portal</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in with the email and PIN provided by GPM.</p>

      <form action={formAction} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500" htmlFor="pin">
            Portal PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            required
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
