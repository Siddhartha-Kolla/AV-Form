"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Paperclip, Pencil, TriangleAlert } from "lucide-react";
import { ARTEN, type ArtId } from "@/lib/registration";
import {
  betreuungNoetig,
  feldBezeichnung,
  filtere,
  gruppiere,
  juengsteAenderung,
  knappAngemeldet,
  technikKurz,
  unterlagenFehlen,
  type Listeneintrag,
  type ZeitAuswahl,
} from "@/lib/dashboard";
import { datumTeile, inTagen } from "@/lib/format";
import { SelectField, TextField } from "@/components/fields";
import { cn } from "@/lib/utils";

const ZEITEN: { id: ZeitAuswahl; text: string }[] = [
  { id: "anstehend", text: "Anstehend" },
  { id: "vergangen", text: "Vergangen" },
  { id: "alle", text: "Alle" },
];

function plural(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

/**
 * Suche und Filter laufen im Browser. Die Liste ist klein und liegt schon vollständig vor,
 * deshalb erscheint jedes Ergebnis beim Tippen sofort, ohne dass die Seite neu geladen wird.
 * Die Auswahl steht zusätzlich in der Adresse, damit ein Neuladen oder ein geteilter Link sie behält.
 */
export function UebersichtListe({
  eintraege,
  heute,
  start,
}: {
  eintraege: Listeneintrag[];
  heute: string;
  start: { zeit: ZeitAuswahl; art: ArtId | ""; suche: string };
}) {
  const [zeit, setZeit] = useState<ZeitAuswahl>(start.zeit);
  const [art, setArt] = useState<ArtId | "">(start.art);
  const [suche, setSuche] = useState(start.suche);

  useEffect(() => {
    const p = new URLSearchParams();
    if (zeit !== "anstehend") p.set("zeit", zeit);
    if (art) p.set("art", art);
    if (suche.trim()) p.set("q", suche.trim());
    const text = p.toString();
    window.history.replaceState(null, "", text ? `/team?${text}` : "/team");
  }, [zeit, art, suche]);

  const sicht = useMemo(
    () => filtere(eintraege, { zeit, art: art || undefined, suche }, heute),
    [eintraege, zeit, art, suche, heute],
  );
  const gruppen = useMemo(() => gruppiere(sicht, zeit, heute), [sicht, zeit, heute]);
  const gefiltert = !!(art || suche.trim());

  return (
    <div>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div role="tablist" aria-label="Zeitraum" className="-mx-2 flex gap-1">
          {ZEITEN.map((z) => (
            <button
              key={z.id}
              type="button"
              role="tab"
              aria-selected={z.id === zeit}
              onClick={() => setZeit(z.id)}
              className={cn(
                "rounded-md px-3 py-2 text-[15px] transition-colors hover:bg-muted",
                z.id === zeit ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {z.text}
            </button>
          ))}
        </div>
        <div role="search" className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
          <TextField
            id="q"
            label="Suchen"
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSuche("");
            }}
            placeholder="Titel, Lehrkraft, Ort"
            className="w-full sm:w-64"
            autoComplete="off"
            spellCheck={false}
          />
          <SelectField
            id="art"
            label="Art"
            value={art}
            onChange={(e) => setArt(e.target.value as ArtId | "")}
            className="w-full sm:w-52"
          >
            <option value="">Alle Arten</option>
            {ARTEN.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </SelectField>
          {gefiltert && (
            <button
              type="button"
              onClick={() => {
                setSuche("");
                setArt("");
              }}
              className="pb-3 text-sm underline underline-offset-4"
            >
              Zurücksetzen
            </button>
          )}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {gefiltert ? `${plural(sicht.length, "Veranstaltung", "Veranstaltungen")} gefunden.` : ""}
      </p>

      {sicht.length === 0 ? (
        <Leer insgesamt={eintraege.length} gefiltert={gefiltert} zeit={zeit} />
      ) : (
        <div className="mt-10 space-y-12">
          {gruppen.map((g) => (
            <section key={g.schluessel} aria-labelledby={`gruppe-${g.schluessel}`}>
              <h2 id={`gruppe-${g.schluessel}`} className="mb-2 flex items-baseline gap-3">
                <span className="text-lg font-semibold tracking-tight">{g.titel}</span>
                <span className="text-sm text-muted-foreground">
                  {plural(g.eintraege.length, "Veranstaltung", "Veranstaltungen")}
                </span>
              </h2>
              <ul className="divide-y divide-border border-y border-border md:-mx-3">
                {g.eintraege.map((e) => (
                  <Zeile key={e.id} e={e} heute={heute} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Leer({ insgesamt, gefiltert, zeit }: { insgesamt: number; gefiltert: boolean; zeit: ZeitAuswahl }) {
  if (insgesamt === 0) {
    return (
      <div className="mt-12 max-w-[56ch]">
        <p className="text-[15px] font-medium">Noch keine Anmeldungen.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sobald eine Lehrkraft das Formular abschickt, steht die Veranstaltung hier. Das Formular erreichst du unter{" "}
          <Link href="/" className="underline underline-offset-4">
            der Startseite
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="mt-12 max-w-[56ch]">
      <p className="text-[15px] font-medium">
        {gefiltert
          ? "Keine Anmeldung passt zu dieser Auswahl."
          : zeit === "anstehend"
            ? "Es steht keine Veranstaltung an."
            : "Hier gibt es nichts zu zeigen."}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {zeit === "anstehend" && !gefiltert
          ? "Unter Vergangen und Alle findest du ältere Anmeldungen."
          : "Ändere den Zeitraum oder die Filter, um mehr zu sehen."}
      </p>
    </div>
  );
}

/**
 * Eine Veranstaltung in drei Ebenen:
 * 1. Wann und was: großes Datum, Titel.
 * 2. Der Rahmen: Uhrzeit, Ort, Lehrkraft und Art, Technik, Techniker.
 * 3. Was Aufmerksamkeit braucht: rechts, nur wenn es etwas gibt.
 */
function Zeile({ e, heute }: { e: Listeneintrag; heute: string }) {
  const v = e.values;
  const knapp = knappAngemeldet(e);
  const aenderung = juengsteAenderung(e, heute);
  const fehlen = unterlagenFehlen(e, heute);
  const vergangen = v.datum < heute;
  const istHeute = v.datum === heute;
  const datum = datumTeile(v.datum);
  const techniker = betreuungNoetig(v);

  const arten: string[] = v.arten.map((id) => ARTEN.find((a) => a.id === id)?.label ?? id);
  if (v.arten.includes("sonstiges") && v.art_sonstiges.trim()) {
    arten[arten.indexOf("Sonstiges")] = v.art_sonstiges.trim();
  }
  const felder = aenderung?.felder.map(feldBezeichnung) ?? [];
  const felderText = felder.length > 3 ? `${felder.slice(0, 3).join(", ")} und ${felder.length - 3} weitere` : felder.join(", ");

  return (
    <li className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-5 transition-colors hover:bg-muted/60 md:grid-cols-[4.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6 md:px-3">
      <div className={cn("leading-none", vergangen && "text-muted-foreground")}>
        <p className={cn("text-[1.75rem] font-semibold tabular-nums tracking-tight", istHeute && "text-primary")}>{datum.tag}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {datum.wochentag} {datum.monat}
        </p>
      </div>

      <div className="min-w-0">
        <Link
          href={`/team/anmeldungen/${e.id}`}
          className="text-base font-semibold leading-snug after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-[3px] focus-visible:after:ring-ring/40"
        >
          {v.titel}
        </Link>
        <p className="mt-1 text-sm tabular-nums">
          {v.beginn} bis {v.ende} Uhr, {v.ort}
        </p>
        <p className="text-sm text-muted-foreground">
          {v.lehrkraft}
          {arten.length > 0 && `, ${arten.join(" und ")}`}
        </p>
      </div>

      <div className="col-start-2 text-sm md:col-start-auto">
        <p>{technikKurz(v)}</p>
        {techniker && <p className="mt-0.5 text-muted-foreground">Techniker: {techniker}</p>}
      </div>

      <ul className="col-start-2 space-y-1 text-sm md:col-start-auto">
        {!vergangen && <li className="text-muted-foreground">{inTagen(v.datum, heute)}</li>}
        {knapp && (
          <li className="flex items-start gap-1.5 font-medium text-note-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Zu knapp angemeldet
          </li>
        )}
        {fehlen && (
          <li className="flex items-start gap-1.5 font-medium text-note-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Unterlagen fehlen
          </li>
        )}
        {e.dateienAnzahl > 0 && (
          <li className="flex items-start gap-1.5 text-muted-foreground">
            <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {e.dateienAnzahl === 1 ? "1 Datei" : `${e.dateienAnzahl} Dateien`}
          </li>
        )}
        {aenderung && (
          <li className="flex items-start gap-1.5 text-muted-foreground">
            <Pencil className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Geändert: {felderText}</span>
          </li>
        )}
      </ul>
    </li>
  );
}
