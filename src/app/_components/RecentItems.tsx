"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface RecentItem {
  href: string;
  label: string;
  viewedAt: number;
}

const STORAGE_KEY = "sgms-recent-items";
const MAX_ITEMS = 10;
const EXCLUDED_PATHS = ["/login"];

function readRecentItems(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

function writeRecentItems(items: RecentItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function RecentItems() {
  const pathname = usePathname();
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    // This effect also covers the initial load — Sidebar (and so this
    // component) only ever mounts on authenticated pages, never on /login,
    // so there's no excluded-path case where storage would go unread.
    if (EXCLUDED_PATHS.includes(pathname)) return;

    // Deferred so the new route's content (the h1 this label is read from)
    // has actually committed to the DOM before we capture it.
    const timer = setTimeout(() => {
      const label = document.querySelector("main h1")?.textContent?.trim();
      const existing = readRecentItems().filter((item) => item.href !== pathname);
      const updated = label ? [{ href: pathname, label, viewedAt: Date.now() }, ...existing].slice(0, MAX_ITEMS) : existing;
      if (label) writeRecentItems(updated);
      setItems(updated);
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-200 px-2 pt-3 dark:border-neutral-800">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-500">Recent Items</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block truncate rounded-md px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white"
              title={item.label}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
