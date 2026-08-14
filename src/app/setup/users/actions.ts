"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { staffUsers, staffRoleEnum } from "@/db/schema/setup";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AddStaffUserState {
  error?: string;
}

export async function addStaffUser(_prevState: AddStaffUserState | undefined, formData: FormData): Promise<AddStaffUserState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const role = formData.get("role");

  if (typeof name !== "string" || !name.trim()) {
    return { error: "Name is required." };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { error: "Email is required." };
  }
  const resolvedRole = staffRoleEnum.enumValues.includes(role as (typeof staffRoleEnum.enumValues)[number])
    ? (role as (typeof staffRoleEnum.enumValues)[number])
    : "STAFF";

  await db.insert(staffUsers).values({ name: name.trim(), email: email.trim(), role: resolvedRole });

  revalidatePath("/setup/users");
  return {};
}

export interface SendStaffInviteState {
  error?: string;
  success?: string;
}

// Creates (or re-invites) the real Supabase Auth login and emails a link to
// set a password — the staff_users row above is just a directory entry and
// was never itself a real login. Requires the Invite user email template in
// the Supabase dashboard to link to /auth/confirm?token_hash={{ .TokenHash
// }}&type=invite&next=/set-password — the default template doesn't route
// through our own verify endpoint.
export async function sendStaffInviteAction(email: string): Promise<SendStaffInviteState> {
  if (!email.trim()) return { error: "Missing email." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return { error: "NEXT_PUBLIC_SITE_URL is not configured." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${siteUrl}/auth/confirm?next=/set-password`,
  });
  if (error) return { error: error.message };
  return { success: "Invite sent." };
}
