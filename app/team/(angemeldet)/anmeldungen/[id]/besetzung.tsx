"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  ANTWORT_TEXT,
  MAX_BENOETIGT,
  MAX_NOTIZ,
  besetzungText,
  fehlend,
  zaehle,
  type Antwort,
  type MeineAntwort,
} from "@/lib/besetzung";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/server/einsaetze";
import { besetzungPlanenAktion, einsatzSetzenAktion } from "./actions";

const STATUS_ZEICHEN: Record<MeineAntwort, { symbol: typeof Check | null; klasse: string }> = {
  dabei: { symbol: Check, klasse: "font-medium text-primary" },
  nicht_dabei: { symbol: X, klasse: "text-muted-foreground" },
  offen: { symbol: null, klasse: "text-muted-foreground" },
};

/**
 * Die Besetzung einer Veranstaltung: wer vom Team dabei ist. Jeder antwortet für sich mit einem Klick,
 * eine Notiz ist möglich. Admins können für andere eintragen und die Veranstaltung zur Pflicht machen.
 */
export function Besetzung({
  anmeldungId,
  pflicht,
  benoetigt,
  personen,
  meineId,
  kannPlanen,
  gesperrt,
}: {
  anmeldungId: string;
  pflicht: boolean;
  benoetigt: number | null;
  personen: Person[];
  meineId: string;
  kannPlanen: boolean;
  /** Warum sich nichts mehr ändern lässt, zum Beispiel weil die Veranstaltung vorbei ist. */
  gesperrt: string | null;
}) {
  // Die Planung ist Sache der Admins und eingeklappt, damit die Liste ruhig bleibt.
  const [planen, setPlanen] = useState(false);
  const zahlen = zaehle(personen);
  const fehlt = fehlend({ dabei: zahlen.dabei, benoetigt });
  const weitere = [
    zahlen.offen > 0 && `${zahlen.offen} offen`,
    zahlen.nichtDabei > 0 && `${zahlen.nichtDabei} nicht dabei`,
  ].filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold">{besetzungText({ dabei: zahlen.dabei, benoetigt })}</span>
          {pflicht && <span className="text-sm font-semibold text-note-foreground">Pflicht</span>}
          {weitere.length > 0 && <span className="text-sm text-muted-foreground">{weitere.join(", ")}</span>}
        </p>
        {kannPlanen && !gesperrt && (
          <button
            type="button"
            onClick={() => setPlanen(!planen)}
            aria-expanded={planen}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {planen ? "Schließen" : "Pflicht und Bedarf"}
          </button>
        )}
      </div>
      {!gesperrt && fehlt > 0 && (
        <p className="mt-1 text-sm text-note-foreground">{fehlt === 1 ? "Es fehlt noch 1 Person." : `Es fehlen noch ${fehlt} Personen.`}</p>
      )}
      {gesperrt && <p className="mt-1 text-sm text-muted-foreground">{gesperrt} Die Besetzung lässt sich nicht mehr ändern.</p>}

      {kannPlanen && !gesperrt && planen && (
        <Planung anmeldungId={anmeldungId} pflicht={pflicht} benoetigt={benoetigt} fertig={() => setPlanen(false)} />
      )}

      <ul className="mt-3 divide-y divide-border">
        {personen.map((p) => (
          <PersonZeile key={p.kontoId} anmeldungId={anmeldungId} p={p} ich={p.kontoId === meineId} pflicht={pflicht} darfAendern={!gesperrt && (p.kontoId === meineId || kannPlanen)} />
        ))}
      </ul>
    </div>
  );
}

/** Admins: Pflicht und Zahl der gebrauchten Leute festlegen. */
function Planung({ anmeldungId, pflicht, benoetigt, fertig }: { anmeldungId: string; pflicht: boolean; benoetigt: number | null; fertig: () => void }) {
  const [istPflicht, setIstPflicht] = useState(pflicht);
  const [zahl, setZahl] = useState(benoetigt === null ? "" : String(benoetigt));
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    starte(async () => {
      const antwort = await besetzungPlanenAktion({ anmeldungId, pflicht: istPflicht, benoetigt: zahl });
      if (!antwort.ok) setFehler(antwort.meldung);
      else fertig();
    });
  }

  return (
    <form onSubmit={speichern} className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md bg-muted/60 px-4 py-3">
      <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
        <input type="checkbox" checked={istPflicht} onChange={(e) => setIstPflicht(e.target.checked)} className="size-4 accent-primary" />
        Pflicht für das Team
      </label>
      <label className="flex items-center gap-2.5 text-[15px]">
        Benötigt
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_BENOETIGT}
          value={zahl}
          onChange={(e) => setZahl(e.target.value)}
          placeholder="offen"
          aria-label="Wie viele Personen gebraucht werden"
          className="h-9 w-20 rounded-md border border-input bg-surface px-2.5 text-[15px] tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
      </label>
      <Button type="submit" disabled={laeuft} className="h-9 px-4 text-[15px]">
        {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        Speichern
      </Button>
      {fehler && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {fehler}
        </p>
      )}
    </form>
  );
}

function PersonZeile({
  anmeldungId,
  p,
  ich,
  pflicht,
  darfAendern,
}: {
  anmeldungId: string;
  p: Person;
  ich: boolean;
  pflicht: boolean;
  darfAendern: boolean;
}) {
  // Die eigene Zeile hat die Knöpfe immer offen, bei anderen öffnet sie ein Admin mit "Ändern".
  const [offen, setOffen] = useState(false);
  const zeichen = STATUS_ZEICHEN[p.antwort];
  const zeigeEditor = darfAendern && (ich || offen);

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Avatar id={p.kontoId} name={p.name} version={p.bildVersion} className="size-8 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">
            {p.name}
            {ich && <span className="ml-2 text-sm font-normal text-muted-foreground">du</span>}
          </p>
          {p.notiz && !zeigeEditor && <p className="break-words text-sm text-muted-foreground">{p.notiz}</p>}
        </div>
        {/* Die eigene Antwort zeigen schon die Knöpfe darunter. */}
        {!(ich && zeigeEditor) && (
          <p className={cn("flex shrink-0 items-center gap-1.5 text-sm", zeichen.klasse)}>
            {zeichen.symbol && <zeichen.symbol className="size-4" aria-hidden="true" />}
            {ANTWORT_TEXT[p.antwort]}
          </p>
        )}
        {darfAendern && !ich && (
          <Button type="button" variant="ghost" onClick={() => setOffen(!offen)} aria-expanded={offen} className="-mr-2 h-8 px-2.5 text-sm text-muted-foreground">
            {offen ? "Schließen" : "Ändern"}
          </Button>
        )}
      </div>
      {zeigeEditor && (
        <Editor anmeldungId={anmeldungId} p={p} pflicht={pflicht} fuerAndere={!ich} fertig={() => setOffen(false)} />
      )}
    </li>
  );
}

/** Zwei Knöpfe, die Notiz erst auf Wunsch. Ein Klick auf eine Antwort speichert sofort, eine geänderte Notiz mit Enter oder "Notiz speichern". */
function Editor({
  anmeldungId,
  p,
  pflicht,
  fuerAndere,
  fertig,
}: {
  anmeldungId: string;
  p: Person;
  pflicht: boolean;
  fuerAndere: boolean;
  fertig: () => void;
}) {
  const [notiz, setNotiz] = useState(p.notiz ?? "");
  const [notizOffen, setNotizOffen] = useState(!!p.notiz);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const feld = useRef<HTMLInputElement>(null);
  const notizGeaendert = p.antwort !== "offen" && notiz.trim() !== (p.notiz ?? "");

  function senden(antwort: Antwort) {
    if (antwort === "nicht_dabei" && pflicht && !notiz.trim()) {
      setFehler(fuerAndere ? "Bei einer Pflicht braucht ein „Nicht dabei“ eine kurze Begründung." : "Bitte schreibe kurz, warum du nicht dabei sein kannst.");
      setNotizOffen(true);
      feld.current?.focus();
      return;
    }
    setFehler(null);
    starte(async () => {
      const ergebnis = await einsatzSetzenAktion({ anmeldungId, kontoId: p.kontoId, antwort, notiz });
      if (!ergebnis.ok) setFehler(ergebnis.meldung);
      else if (fuerAndere) fertig();
    });
  }

  const knopf = (antwort: Antwort) => {
    const gewaehlt = p.antwort === antwort;
    return (
      <button
        type="button"
        aria-pressed={gewaehlt}
        disabled={laeuft}
        onClick={() => senden(antwort)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border px-3.5 text-[15px] transition-colors disabled:opacity-60",
          gewaehlt
            ? antwort === "dabei"
              ? "border-primary bg-primary font-medium text-primary-foreground"
              : "border-foreground/60 bg-muted font-medium"
            : "border-input bg-surface hover:border-foreground/50",
        )}
      >
        {antwort === "dabei" ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
        {ANTWORT_TEXT[antwort]}
      </button>
    );
  };

  return (
    <div className="mt-2.5 space-y-2.5 sm:pl-11">
      <div className="flex flex-wrap items-center gap-2">
        {knopf("dabei")}
        {knopf("nicht_dabei")}
        {!notizOffen && (
          <button
            type="button"
            onClick={() => {
              setNotizOffen(true);
              // Das Feld gibt es erst nach dem Rendern.
              setTimeout(() => feld.current?.focus(), 0);
            }}
            className="h-9 px-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Notiz hinzufügen
          </button>
        )}
        {laeuft && <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Wird gespeichert" />}
      </div>
      {notizOffen && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={feld}
            type="text"
            value={notiz}
            maxLength={MAX_NOTIZ}
            onChange={(e) => setNotiz(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && notizGeaendert && p.antwort !== "offen") {
                e.preventDefault();
                senden(p.antwort);
              }
            }}
            disabled={laeuft}
            aria-label={fuerAndere ? `Notiz für ${p.name}` : "Notiz"}
            placeholder={pflicht ? "Notiz, bei „Nicht dabei“ Pflicht" : "Notiz, zum Beispiel „erst ab 17 Uhr“"}
            autoComplete="off"
            className="h-9 min-w-0 flex-1 basis-56 rounded-md border border-input bg-surface px-3 text-[15px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          {notizGeaendert && (
            <Button type="button" variant="outline" disabled={laeuft} onClick={() => p.antwort !== "offen" && senden(p.antwort)} className="h-9 border-input bg-surface px-3.5 text-[15px] shadow-none">
              Notiz speichern
            </Button>
          )}
        </div>
      )}
      {fehler && (
        <p role="alert" className="text-sm text-destructive">
          {fehler}
        </p>
      )}
    </div>
  );
}
