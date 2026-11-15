"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TeamNav({ eintraege }: { eintraege: { href: string; text: string }[] }) {
  const pfad = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="-mx-2 flex flex-wrap gap-1">
      {eintraege.map((e) => {
        const aktiv = pfad === e.href || pfad.startsWith(`${e.href}/`);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-[15px] transition-colors hover:bg-muted",
              aktiv ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {e.text}
          </Link>
        );
      })}
    </nav>
  );
}
