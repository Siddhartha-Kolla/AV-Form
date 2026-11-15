"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/fields";
import { andereSitzungenBeendenAktion, passwortAendernAktion, type KontoZustand } from "./actions";

export function PasswortAendern() {
  const [zustand, aktion, laeuft] = useActionState<KontoZustand, FormData>(passwortAendernAktion, {});
  return (
    <form action={aktion} className="max-w-sm space-y-5" aria-busy={laeuft}>
      <TextField id="aktuell" label="Aktuelles Passwort" type="password" required autoComplete="current-password" />
      <TextField
        id="neu"
        label="Neues Passwort"
        type="password"
        required
        autoComplete="new-password"
        hint="Mindestens 12 Zeichen. Ein Satz aus mehreren Wörtern funktioniert gut."
      />
      <TextField id="wiederholung" label="Neues Passwort wiederholen" type="password" required autoComplete="new-password" />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={laeuft} className="h-11 px-5 text-[15px]">
          {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          Passwort ändern
        </Button>
        {zustand.fehler && (
          <p role="alert" className="text-sm text-destructive">
            {zustand.fehler}
          </p>
        )}
        {zustand.ok && zustand.meldung && (
          <p role="status" className="text-sm text-muted-foreground">
            {zustand.meldung}
          </p>
        )}
      </div>
    </form>
  );
}

export function AndereSitzungenBeenden() {
  const [zustand, aktion, laeuft] = useActionState<KontoZustand, FormData>(andereSitzungenBeendenAktion, {});
  return (
    <form action={aktion} className="flex flex-wrap items-center gap-4">
      <Button type="submit" variant="outline" disabled={laeuft} className="h-10 border-input bg-surface px-4 shadow-none">
        {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Alle anderen Sitzungen beenden
      </Button>
      {zustand.meldung && (
        <p role="status" className="text-sm text-muted-foreground">
          {zustand.meldung}
        </p>
      )}
    </form>
  );
}
