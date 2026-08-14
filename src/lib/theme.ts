import { cookies } from "next/headers";

export type Theme = "light" | "dark";

const COOKIE_NAME = "theme";

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "dark" ? "dark" : "light";
}
