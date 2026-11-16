"use client";

import { useState } from "react";
import { kuerzel } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Das Namensschild eines Teammitglieds: das Profilbild, sonst die Initialen.
 * Größe und Schrift kommen über className. Ein Bild, das sich nicht laden lässt, fällt auf die Initialen zurück.
 */
export function Avatar({
  id,
  name,
  version,
  className,
}: {
  id: string;
  name: string;
  version: string | null;
  className?: string;
}) {
  // Gemerkt wird die Version, die nicht ging. Ein neues Bild bekommt so wieder eine Chance.
  const [kaputt, setKaputt] = useState<string | null>(null);
  const grund = "shrink-0 rounded-full";

  if (version && kaputt !== version) {
    return (
      // Ein geschütztes Bild aus der eigenen Anwendung. next/image brächte hier nichts.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/team/bild/${id}?v=${encodeURIComponent(version)}`}
        alt=""
        onError={() => setKaputt(version)}
        className={cn(grund, "bg-muted object-cover ring-1 ring-inset ring-border", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(grund, "grid place-items-center bg-accent font-semibold text-accent-foreground", className)}
    >
      {kuerzel(name)}
    </span>
  );
}
