"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/app/actions";

export default function SetPasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    setPending(true);
    setError(null);
    const result = await changePasswordAction(newPassword, confirmPassword);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess("Password set — you're all set.");
    setTimeout(() => router.push("/contracts"), 1200);
  }

  if (success) {
    return <p className="text-sm text-emerald-700">{success}</p>;
  }

  return (
    <div className="w-full max-w-sm">
      <label className="mb-1 block text-xs text-slate-500" htmlFor="newPassword">
        New Password
      </label>
      <input
        id="newPassword"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        disabled={pending}
        className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />
      <label className="mb-1 block text-xs text-slate-500" htmlFor="confirmPassword">
        Confirm Password
      </label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={pending}
        className="mb-4 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !newPassword || !confirmPassword}
        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set Password"}
      </button>
    </div>
  );
}
