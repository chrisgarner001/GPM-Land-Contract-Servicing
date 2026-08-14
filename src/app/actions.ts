"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Theme } from "@/lib/theme";

export async function setThemeAction(theme: Theme): Promise<void> {
  const store = await cookies();
  store.set("theme", theme, { maxAge: 60 * 60 * 24 * 365, path: "/" });
}

export interface ChangePasswordState {
  error?: string;
  success?: string;
}

export async function changePasswordAction(newPassword: string, confirmPassword: string): Promise<ChangePasswordState> {
  if (newPassword.length < 6) return { error: "Password must be at least 6 characters." };
  if (newPassword !== confirmPassword) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { success: "Password updated." };
}
