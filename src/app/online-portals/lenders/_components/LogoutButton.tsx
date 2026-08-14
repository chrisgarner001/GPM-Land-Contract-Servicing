"use client";

import { lenderLogoutAction } from "../actions";

export default function LogoutButton() {
  return (
    <form action={lenderLogoutAction}>
      <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline">
        Sign out
      </button>
    </form>
  );
}
