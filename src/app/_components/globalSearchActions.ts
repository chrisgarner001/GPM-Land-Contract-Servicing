"use server";

import { searchGlobal, type GlobalSearchResults } from "@/server/globalSearch";

export async function globalSearchAction(query: string): Promise<GlobalSearchResults> {
  return searchGlobal(query);
}
