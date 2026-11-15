"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/dialog";
import { anmeldungLoeschenAktion, type LoeschZustand } from "./actions";

export function AnmeldungLoeschen({ id, titel }: { id: string; titel: string }) {
  const [zustand, aktion, laeuft] = useActionState<LoeschZustand, FormData>(anmeldungLoeschenAktion, {});
  return (
    <Dialog
      titel="Anmeldung löschen"
      beschreibung={`„${titel}“ wird mit allen Dateien und dem Änderungsverlauf entfernt. Das lässt sich nicht rückgängig machen.`}
      knopf="Anmeldung löschen"
      knopfClassName="border-destructive/40 text-destructive hover:bg-destructive/10"
    >
      <form action={aktion} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <Button
          type="submit"
          disabled={laeuft}
          className="h-10 border border-destructive/40 bg-surface px-4 text-[15px] text-destructive shadow-none hover:bg-destructive/10"
        >
          {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          Ja, endgültig löschen
        </Button>
        {zustand.fehler && (
          <p role="alert" className="text-sm text-destructive">
            {zustand.fehler}
          </p>
        )}
      </form>
    </Dialog>
  );
}
