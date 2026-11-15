"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Zeigt ein erzeugtes Startpasswort. Es erscheint nur einmal, danach lässt es sich nicht mehr abrufen. */
export function Startpasswort({ passwort, benutzername }: { passwort: string; benutzername: string }) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(passwort);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Ohne Zugriff auf die Zwischenablage bleibt das Markieren von Hand.
    }
  }

  return (
    <div className="rounded-md border border-border bg-muted p-4">
      <p className="text-sm text-muted-foreground">
        Startpasswort für <span className="font-medium text-foreground">{benutzername}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <output className="select-all font-mono text-lg tracking-wide">{passwort}</output>
        <button
          type="button"
          onClick={kopieren}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-surface px-3 text-sm font-medium transition-colors hover:border-foreground/50"
        >
          {kopiert ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {kopiert ? "Kopiert" : "Kopieren"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Dieses Passwort wird nur jetzt angezeigt. Gib es sicher weiter. Beim ersten Login wählt die Person ein
        eigenes.
      </p>
    </div>
  );
}
