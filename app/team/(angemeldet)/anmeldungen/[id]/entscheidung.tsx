"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, MessageCircleQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/fields";
import {
  ENTSCHEIDUNGEN,
  ENTSCHEIDUNGS_TEXTE,
  MAX_NACHRICHT,
  type Entscheidung,
  type StatusId,
} from "@/lib/entscheidung";
import { cn } from "@/lib/utils";
import { anmeldungEntscheidenAktion } from "./actions";

const SYMBOL = { angenommen: Check, rueckfrage: MessageCircleQuestion, abgelehnt: X } as const;

/**
 * Die Knöpfe zur Entscheidung und der Dialog dazu. Angeboten wird jede Entscheidung außer der,
 * die schon gilt. Der Dialog lässt Platz für eine Nachricht an die Lehrkraft.
 */
export function Entscheidungsknoepfe({ id, status }: { id: string; status: StatusId }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [wahl, setWahl] = useState<Entscheidung | null>(null);

  function oeffnen(w: Entscheidung) {
    setWahl(w);
    dialog.current?.showModal();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ENTSCHEIDUNGEN.filter((e) => e !== status).map((e) => {
          const Symbol = SYMBOL[e];
          // Bei einer offenen Anmeldung ist Annehmen der Hauptweg.
          const haupt = e === "angenommen" && status !== "abgelehnt";
          return (
            <Button
              key={e}
              type="button"
              variant={haupt ? "default" : "outline"}
              onClick={() => oeffnen(e)}
              className={cn("h-10 gap-2 px-4 text-[15px] shadow-none", !haupt && "border-input bg-surface hover:border-foreground/50")}
            >
              <Symbol className="size-4" aria-hidden="true" />
              {ENTSCHEIDUNGS_TEXTE[e].knopf}
            </Button>
          );
        })}
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="entscheidung-titel"
        onClose={() => setWahl(null)}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_12px_40px_rgb(0_0_0/0.14)] backdrop:bg-foreground/35"
      >
        {/* Nur solange der Dialog offen ist: so beginnt jede Entscheidung ohne alte Eingaben und Fehler. */}
        {wahl && <Formular id={id} status={status} wahl={wahl} schliessen={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}

function Formular({
  id,
  status,
  wahl,
  schliessen,
}: {
  id: string;
  status: StatusId;
  wahl: Entscheidung;
  schliessen: () => void;
}) {
  const text = ENTSCHEIDUNGS_TEXTE[wahl];
  const [nachricht, setNachricht] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function senden(e: React.FormEvent) {
    e.preventDefault();
    if (text.pflicht && !nachricht.trim()) {
      setFehler("Bitte schreibe, was die Lehrkraft klären soll.");
      return;
    }
    setFehler(null);
    starte(async () => {
      const antwort = await anmeldungEntscheidenAktion({ id, status: wahl, erwarteterStatus: status, nachricht });
      if (antwort.ok) schliessen();
      else setFehler(antwort.meldung);
    });
  }

  return (
    <form onSubmit={senden} noValidate className="p-5 sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="entscheidung-titel" className="text-lg font-semibold tracking-tight">
            {text.titel}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text.beschreibung}</p>
        </div>
        <button
          type="button"
          onClick={schliessen}
          aria-label="Schließen"
          className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <TextArea
        id="entscheidung-nachricht"
        label={text.feld}
        hint={text.hinweis}
        value={nachricht}
        maxLength={MAX_NACHRICHT}
        rows={5}
        autoFocus
        onChange={(e) => setNachricht(e.target.value)}
        error={fehler && text.pflicht && !nachricht.trim() ? fehler : undefined}
        disabled={laeuft}
      />
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Die Nachricht steht im Verlauf. Danach kannst du sie mit einem Klick als E-Mail an die Lehrkraft öffnen.
      </p>

      {fehler && !(text.pflicht && !nachricht.trim()) && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {fehler}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={schliessen} disabled={laeuft} className="h-10 border-input bg-surface px-4 text-[15px] shadow-none">
          Abbrechen
        </Button>
        <Button type="submit" disabled={laeuft} className="h-10 px-5 text-[15px]">
          {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {text.speichern}
        </Button>
      </div>
    </form>
  );
}
