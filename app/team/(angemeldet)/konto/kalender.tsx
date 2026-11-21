"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { datumZeit } from "@/lib/format";
import { kalenderLinkErzeugenAktion, kalenderLinkLoeschenAktion } from "./actions";

type Links = { alle: string; meine: string };

/**
 * Der persönliche Kalender-Link. Ohne Link gibt es einen Knopf zum Erzeugen. Mit Link wählt man, was im Kalender
 * stehen soll, und kopiert die Adresse. Ein neuer Link macht den alten ungültig, deshalb fragt die Seite vorher nach.
 */
export function Kalender({
  links,
  zuletzt,
  kannMeine,
}: {
  /** Null, solange es keinen Link gibt. */
  links: Links | null;
  zuletzt: string | null;
  /** Der Superuser fährt nicht mit und hat keine eigenen Einsätze. */
  kannMeine: boolean;
}) {
  const [inhalt, setInhalt] = useState<"alle" | "meine">("alle");
  const [frage, setFrage] = useState<"neu" | "weg" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [laeuft, starte] = useTransition();

  function ausfuehren(aktion: () => Promise<{ ok?: boolean; fehler?: string }>) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await aktion();
      if (ergebnis.fehler) setFehler(ergebnis.fehler);
      setFrage(null);
    });
  }

  if (!links) {
    return (
      <div className="max-w-[60ch]">
        <p className="text-[15px] leading-relaxed">
          Mit einem privaten Link tragen sich die angenommenen Veranstaltungen automatisch in deinen eigenen Kalender ein, auch spätere Änderungen.
        </p>
        <Button type="button" onClick={() => ausfuehren(kalenderLinkErzeugenAktion)} disabled={laeuft} className="mt-5 h-10 gap-2 px-4 text-[15px]">
          {laeuft ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CalendarPlus className="size-4" aria-hidden="true" />}
          Kalender-Link erzeugen
        </Button>
        {fehler && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {fehler}
          </p>
        )}
      </div>
    );
  }

  const url = inhalt === "meine" && kannMeine ? links.meine : links.alle;
  const webcal = url.replace(/^https?:\/\//, "webcal://");

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Ohne Zugriff auf die Zwischenablage bleibt das Markieren im Feld.
      setFehler("Das Kopieren hat nicht geklappt. Markiere die Adresse und kopiere sie selbst.");
    }
  }

  const option = (wert: "alle" | "meine", text: string) => (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
      <input type="radio" name="kalender-inhalt" checked={inhalt === wert} onChange={() => setInhalt(wert)} className="size-4 accent-primary" />
      {text}
    </label>
  );

  return (
    <div className="max-w-xl">
      {kannMeine && (
        <fieldset className="mb-5 space-y-2.5">
          <legend className="mb-2.5 text-sm text-muted-foreground">Was soll im Kalender stehen?</legend>
          {option("alle", "Alle angenommenen Veranstaltungen")}
          {option("meine", "Nur Veranstaltungen, bei denen ich dabei bin")}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Adresse des Kalenders"
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 basis-64 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <Button type="button" variant="outline" onClick={kopieren} className="h-10 gap-2 border-input bg-surface px-4 text-[15px] shadow-none">
          {kopiert ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {kopiert ? "Kopiert" : "Kopieren"}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        <a href={webcal} className="underline underline-offset-4 hover:text-foreground">
          In meiner Kalender-App öffnen
        </a>
        {" "}
        (Apple Kalender, Outlook, Thunderbird)
      </p>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">So fügst du den Kalender hinzu</summary>
        <ul className="mt-3 space-y-2 leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Google Kalender:</span> am Computer links bei „Weitere Kalender“ auf Plus, dann „Per URL“, Adresse einfügen. Auf dem Handy geht es nur so, und der Kalender erscheint danach auch dort.
          </li>
          <li>
            <span className="font-medium text-foreground">Apple Kalender:</span> auf „In meiner Kalender-App öffnen“ tippen und „Abonnieren“ bestätigen.
          </li>
          <li>
            <span className="font-medium text-foreground">Outlook:</span> „Kalender hinzufügen“, „Aus dem Internet“, Adresse einfügen.
          </li>
          <li>Google lädt Änderungen nur alle paar Stunden nach, andere Programme stündlich.</li>
        </ul>
      </details>

      <p className="mt-6 text-sm text-muted-foreground">
        {zuletzt ? `Zuletzt abgerufen am ${datumZeit(zuletzt)}.` : "Noch nicht abgerufen."} Der Link ist privat: Wer ihn kennt, sieht den Kalender.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {frage ? (
          <>
            <p className="text-sm">{frage === "neu" ? "Der alte Link funktioniert dann nicht mehr." : "Der Kalender hört dann auf, sich zu aktualisieren."}</p>
            <Button
              type="button"
              onClick={() => ausfuehren(frage === "neu" ? kalenderLinkErzeugenAktion : kalenderLinkLoeschenAktion)}
              disabled={laeuft}
              className="h-9 px-4 text-[15px]"
            >
              {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {frage === "neu" ? "Neuen Link erzeugen" : "Link löschen"}
            </Button>
            <button type="button" onClick={() => setFrage(null)} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Abbrechen
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setFrage("neu")} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Neuen Link erzeugen
            </button>
            <button type="button" onClick={() => setFrage("weg")} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Link löschen
            </button>
          </>
        )}
      </div>
      {fehler && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {fehler}
        </p>
      )}
    </div>
  );
}
