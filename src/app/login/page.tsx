"use client";

import { useActionState } from "react";
import CompanyLogo from "@/app/_components/CompanyLogo";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <form action={action} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <CompanyLogo className="mb-6 h-8" />
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Land Contract Servicing</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to continue.</p>

        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        {state?.error && <p className="mb-4 text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
