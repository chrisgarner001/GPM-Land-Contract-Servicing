"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { globalSearchAction } from "./globalSearchActions";
import type { GlobalSearchResults } from "@/server/globalSearch";

const EMPTY_RESULTS: GlobalSearchResults = { contracts: [], properties: [], borrowers: [], lenders: [], vendors: [] };

const GROUPS: { key: keyof GlobalSearchResults; label: string }[] = [
  { key: "contracts", label: "Land Contracts" },
  { key: "properties", label: "Properties" },
  { key: "borrowers", label: "Borrowers" },
  { key: "lenders", label: "Lenders" },
  { key: "vendors", label: "Vendors" },
];

export default function GlobalSearchBox() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await globalSearchAction(query);
      setResults(r);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    router.push(href);
  }

  const totalResults = GROUPS.reduce((s, g) => s + results[g.key].length, 0);
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative px-2 pb-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search…"
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-7 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults(EMPTY_RESULTS);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-2 right-2 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {loading ? (
            <p className="px-3 py-3 text-sm text-slate-400">Searching…</p>
          ) : totalResults === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400">No matches.</p>
          ) : (
            GROUPS.filter((g) => results[g.key].length > 0).map((g) => (
              <div key={g.key} className="border-b border-slate-100 py-1.5 last:border-b-0 dark:border-neutral-800">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-500">{g.label}</p>
                {results[g.key].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goTo(r.href)}
                    className="block w-full truncate px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    {r.label}
                    {r.sublabel && <span className="ml-1.5 text-xs text-slate-400 dark:text-neutral-500">({r.sublabel})</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
