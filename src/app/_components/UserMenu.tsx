"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Moon, Sun, KeyRound, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { setThemeAction, changePasswordAction } from "@/app/actions";
import type { Theme } from "@/lib/theme";

export default function UserMenu({ userEmail, theme }: { userEmail: string; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSetTheme(next: Theme) {
    document.documentElement.classList.toggle("dark", next === "dark");
    setThemeAction(next);
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          {userEmail}
          <ChevronDown size={14} />
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <div className="px-3 py-2">
              <p className="mb-1.5 text-xs font-medium text-slate-400 dark:text-neutral-500">Appearance</p>
              <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => handleSetTheme("light")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                    theme === "light" ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-700 dark:text-white" : "text-slate-500 dark:text-neutral-400"
                  }`}
                >
                  <Sun size={13} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => handleSetTheme("dark")}
                  className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                    theme === "dark" ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-700 dark:text-white" : "text-slate-500 dark:text-neutral-400"
                  }`}
                >
                  <Moon size={13} /> Dark
                </button>
              </div>
            </div>

            <div className="my-1 border-t border-slate-100 dark:border-neutral-800" />

            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <KeyRound size={15} /> Change Password
            </button>

            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <LogOut size={15} /> Sign out
              </button>
            </form>
          </div>
        )}
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await changePasswordAction(newPassword, confirmPassword);
    setPending(false);
    if (result.error) setError(result.error);
    else setSuccess(result.success ?? "Password updated.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Change Password</h2>

        {success ? (
          <>
            <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-neutral-700"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mb-1 block text-xs text-slate-500 dark:text-neutral-400" htmlFor="newPassword">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={pending}
              className="mb-3 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            <label className="mb-1 block text-xs text-slate-500 dark:text-neutral-400" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={pending}
              className="mb-4 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !newPassword || !confirmPassword}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
