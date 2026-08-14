"use client";

import Link from "next/link";

// Raw DOM event handlers (onClick) can't be attached to a <Link> rendered
// directly from a Server Component — stopPropagation here (needed so
// clicking the lender's name doesn't also toggle the parent <details>) has
// to live inside an actual Client Component.
export default function StopPropagationLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch={false} className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}
