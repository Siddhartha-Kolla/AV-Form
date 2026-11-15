"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavEintrag = {
  href: string;
  text: string;
  /** Nur bei genau diesem Pfad aktiv. */
  exakt?: boolean;
  /** Zusätzliche Pfade, bei denen der Eintrag auch aktiv ist. */
  auchBei?: string[];
};

export function TeamNav({ eintraege }: { eintraege: NavEintrag[] }) {
  const pfad = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="-mx-2 flex flex-wrap gap-1">
      {eintraege.map((e) => {
        const aktiv =
          pfad === e.href ||
          (!e.exakt && pfad.startsWith(`${e.href}/`)) ||
          (e.auchBei ?? []).some((p) => pfad === p || pfad.startsWith(`${p}/`));
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
