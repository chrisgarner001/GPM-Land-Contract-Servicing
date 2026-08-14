"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { staffUsers, staffRoleEnum } from "@/db/schema/setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireEditAccess } from "@/lib/staffRole";

async function currentUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export interface AddStaffUserState {
  error?: string;
}

export async function addStaffUser(_prevState: AddStaffUserState | undefined, formData: FormData): Promise<AddStaffUserState> {
  try {
    await requireEditAccess(await currentUserEmail());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

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
    : "OFFICE";

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
  try {
    await requireEditAccess(await currentUserEmail());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }
  if (!email.trim()) return { error: "Missing email." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return { error: "NEXT_PUBLIC_SITE_URL is not configured." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${siteUrl}/auth/confirm?next=/set-password`,
  });
  if (!error) return { success: "Invite sent." };

  // Already has a real login (e.g. a password was set directly, or they
  // were invited before) — inviteUserByEmail only works for brand-new
  // users. Send a password-reset link instead, so the button still does
  // something useful rather than just reporting a confusing failure.
  if (error.message.toLowerCase().includes("already been registered") || error.code === "email_exists") {
    const supabase = await createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteUrl}/auth/confirm?next=/set-password`,
    });
    if (resetError) return { error: resetError.message };
    return { success: "Already had a login — sent a password reset link instead." };
  }

  return { error: error.message };
}

export interface SetStaffPasswordState {
  error?: string;
  success?: string;
}

// The alternative to emailing an invite link — directly creates (or, if a
// login already exists for this email, resets) a real Supabase Auth login
// with the password typed in right here. Useful when setting someone up in
// person rather than waiting on an email round-trip.
export async function setStaffPasswordAction(email: string, password: string): Promise<SetStaffPasswordState> {
  try {
    await requireEditAccess(await currentUserEmail());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }
  if (!email.trim()) return { error: "Missing email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });

  if (!createError) return { success: "Login created." };

  // Already has a real login — find it and reset the password instead.
  // The admin API has no direct getUserByEmail, so page through listUsers.
  if (createError.message.toLowerCase().includes("already been registered") || createError.code === "email_exists") {
    let page = 1;
    for (;;) {
      const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) return { error: listError.message };
      const match = data.users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (match) {
        const { error: updateError } = await admin.auth.admin.updateUserById(match.id, { password });
        if (updateError) return { error: updateError.message };
        return { success: "Password updated." };
      }
      if (data.users.length < 200) break;
      page += 1;
    }
    return { error: "Couldn't find the existing login for this email." };
  }

  return { error: createError.message };
}
