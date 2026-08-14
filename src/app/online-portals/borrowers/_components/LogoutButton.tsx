"use client";

import { borrowerLogoutAction } from "../actions";

export default function LogoutButton() {
  return (
    <form action={borrowerLogoutAction}>
      <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline">
        Sign out
      </button>
    </form>
  );
}
