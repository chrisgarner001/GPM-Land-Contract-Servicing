"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { glCodes, glCodeTypeEnum } from "@/db/schema/setup";

export interface AddGlCodeState {
  error?: string;
}

export async function addGlCode(_prevState: AddGlCodeState | undefined, formData: FormData): Promise<AddGlCodeState> {
  const code = formData.get("code");
  const description = formData.get("description");
  const type = formData.get("type");

  if (typeof code !== "string" || !code.trim()) {
    return { error: "Code is required." };
  }

  const [existing] = await db.select({ id: glCodes.id }).from(glCodes).where(eq(glCodes.code, code.trim()));
  if (existing) {
    return { error: `GL code "${code.trim()}" already exists.` };
  }

  const resolvedType = glCodeTypeEnum.enumValues.includes(type as (typeof glCodeTypeEnum.enumValues)[number])
    ? (type as (typeof glCodeTypeEnum.enumValues)[number])
    : null;

  await db.insert(glCodes).values({
    code: code.trim(),
    description: typeof description === "string" && description.trim() ? description.trim() : null,
    type: resolvedType,
  });

  revalidatePath("/setup/gl-codes");
  revalidatePath("/vendors/new-invoice");
  return {};
}
