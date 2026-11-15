"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BELEGUNG_TAGE,
  alsBelegungsliste,
  monatsRaster,
  nachTag,
  ueberschneidet,
  verschiebeMonat,
  type Belegung,
} from "@/lib/belegung";
import { datumLangMitWochentag, datumTeile, inTagen, monatTitel } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
  Belegung des Technikteams für Lehrkräfte: ein Monatskalender und darunter jeder Termin als eigene Karte.
  Gezeigt werden nur Datum und Uhrzeit. Eine Belegung ist kein Ausschluss, das Team prüft Überschneidungen selbst.
  Auf großen Bildschirmen steht das Ganze neben dem Formular, auf kleinen klappt es unter den Zeitfeldern auf.
*/

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Monat = { jahr: number; monat: number };

function monatVon(iso: string): Monat {
  return { jahr: Number(iso.slice(0, 4)), monat: Number(iso.slice(5, 7)) - 1 };
}

function schluessel(m: Monat): string {
  return `${m.jahr}-${String(m.monat + 1).padStart(2, "0")}`;
}

function plusTage(iso: string, tage: number): string {
  return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + tage)).toISOString().slice(0, 10);
}

function plural(n: number): string {
  return n === 1 ? "eine Veranstaltung" : `${n} Veranstaltungen`;
}

const zeiten = (b: { beginn: string; ende: string }) => `${b.beginn} bis ${b.ende} Uhr`;
const istUhrzeit = (s: string) => /^\d{2}:\d{2}$/.test(s);

/** Lädt die Belegung einmal. Schlägt das fehl, bleibt das Formular trotzdem benutzbar. */
export function useBelegung(): { liste: Belegung[] | null; fehlgeschlagen: boolean } {
  const [liste, setListe] = useState<Belegung[] | null>(null);
  const [fehlgeschlagen, setFehlgeschlagen] = useState(false);

  useEffect(() => {
    let aktiv = true;
    fetch("/belegung")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Antwort ohne Daten"))))
      .then((daten) => {
        if (!aktiv) return;
        const geprueft = alsBelegungsliste(daten);
        if (geprueft) setListe(geprueft);
        else setFehlgeschlagen(true);
      })
      .catch(() => aktiv && setFehlgeschlagen(true));
    return () => {
      aktiv = false;
    };
  }, []);

  return { liste, fehlgeschlagen };
}

/** Der Hinweis direkt unter den Zeitfeldern: Ist am gewählten Tag schon etwas angemeldet, und passen die Zeiten? */
export function BelegungsHinweis({
  heute,
  datum,
  beginn,
  ende,
  liste,
}: {
  heute: string;
  datum: string;
  beginn: string;
  ende: string;
  liste: Belegung[] | null;
}) {
  const proTag = useMemo(() => nachTag(liste ?? []), [liste]);
  const gewaehlt = /^\d{4}-\d{2}-\d{2}$/.test(datum) && datum >= heute ? (proTag.get(datum) ?? []) : [];
  if (gewaehlt.length === 0) return null;

  const kollidiert = gewaehlt.some((b) => ueberschneidet({ beginn, ende }, b));
  const zeitenAngegeben = istUhrzeit(beginn) && istUhrzeit(ende);
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "max-w-[65ch] text-sm leading-relaxed",
        kollidiert ? "rounded-md bg-note px-4 py-3 text-note-foreground" : "text-muted-foreground",
      )}
    >
      Am {datumLangMitWochentag(datum)} ist schon {plural(gewaehlt.length)} angemeldet: {gewaehlt.map(zeiten).join(" und ")}.{" "}
      {kollidiert
        ? "Die Zeiten überschneiden sich. Sie können trotzdem anmelden, das Team meldet sich bei Ihnen."
        : zeitenAngegeben
          ? "Ihre Zeiten überschneiden sich nicht."
          : ""}
    </p>
  );
}

/** Unter 1280 Pixel Breite: Die Belegung klappt unter den Zeitfeldern auf. Darüber steht sie neben dem Formular. */
export function BelegungsEinklapper(props: PanelProps) {
  const [offen, setOffen] = useState(false);
  const id = useId();
  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={id}
        onClick={() => setOffen((o) => !o)}
        className="-ml-1 inline-flex items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
        Belegung des Teams ansehen
        <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", offen && "rotate-180")} aria-hidden="true" />
      </button>
      <div id={id} hidden={!offen} className="mt-2 max-w-[26rem] rounded-lg border border-border bg-surface p-4">
        <BelegungsPanel {...props} liste={props.liste} kartenHoehe="max-h-72" />
      </div>
    </div>
  );
}

type PanelProps = {
  heute: string;
  datum: string;
  liste: Belegung[] | null;
  fehlgeschlagen: boolean;
  onWaehle: (datum: string) => void;
  /** Höhe der Kartenliste, damit sie bei vielen Terminen für sich scrollt. */
  kartenHoehe?: string;
};

/** Kalender und Karten. Der Rahmen drumherum kommt vom Aufrufer. */
export function BelegungsPanel({ heute, datum, liste, fehlgeschlagen, onWaehle, kartenHoehe }: PanelProps) {
  const proTag = useMemo(() => nachTag(liste ?? []), [liste]);

  if (fehlgeschlagen) {
    return <p className="text-sm text-muted-foreground">Die Belegung lässt sich gerade nicht laden. Sie können das Datum trotzdem eintragen.</p>;
  }
  if (!liste) return <p className="text-sm text-muted-foreground">Belegung wird geladen …</p>;

  return (
    <div className="flex min-h-0 flex-col">
      <Monatskalender heute={heute} datum={datum} proTag={proTag} onWaehle={onWaehle} />
      <Karten heute={heute} datum={datum} liste={liste} hoehe={kartenHoehe} />
    </div>
  );
}

function Monatskalender({
  heute,
  datum,
  proTag,
  onWaehle,
}: {
  heute: string;
  datum: string;
  proTag: Map<string, Belegung[]>;
  onWaehle: (datum: string) => void;
}) {
  // Blättert die Person selbst, bleibt der Monat so, bis sie ein anderes Datum wählt.
  const [blaettern, setBlaettern] = useState<Monat | null>(null);
  const [letztesDatum, setLetztesDatum] = useState(datum);
  if (letztesDatum !== datum) {
    setLetztesDatum(datum);
    setBlaettern(null);
  }

  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(datum);
  const monat = blaettern ?? monatVon(gueltig && datum >= heute ? datum : heute);
  const raster = useMemo(() => monatsRaster(monat.jahr, monat.monat), [monat.jahr, monat.monat]);
  const fruehester = schluessel(monatVon(heute));
  const spaetester = schluessel(monatVon(plusTage(heute, BELEGUNG_TAGE)));
  const frei = gueltig && datum >= heute && !proTag.has(datum);

  const pfeil =
    "grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Voriger Monat"
          disabled={schluessel(monat) <= fruehester}
          onClick={() => setBlaettern(verschiebeMonat(monat.jahr, monat.monat, -1))}
          className={pfeil}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <p aria-live="polite" className="text-[15px] font-semibold">
          {monatTitel(schluessel(monat))}
        </p>
        <button
          type="button"
          aria-label="Nächster Monat"
          disabled={schluessel(monat) >= spaetester}
          onClick={() => setBlaettern(verschiebeMonat(monat.jahr, monat.monat, 1))}
          className={pfeil}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div role="grid" aria-label={`Belegung im ${monatTitel(schluessel(monat))}`}>
        <div role="row" className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {WOCHENTAGE.map((w) => (
            <span key={w} role="columnheader" className="py-1.5">
              {w}
            </span>
          ))}
        </div>
        {raster.map((woche, i) => (
          <div key={i} role="row" className="grid grid-cols-7">
            {woche.map((tag, j) => {
              if (!tag) return <span key={j} role="gridcell" />;
              const vergangen = tag < heute;
              const belegt = proTag.get(tag)?.length ?? 0;
              const istGewaehlt = tag === datum;
              return (
                <span key={j} role="gridcell" className="grid place-items-center">
                  <button
                    type="button"
                    disabled={vergangen}
                    aria-pressed={istGewaehlt}
                    aria-label={`${datumLangMitWochentag(tag)}${belegt > 0 ? `, schon ${plural(belegt)} angemeldet` : ""}`}
                    onClick={() => onWaehle(tag)}
                    className={cn(
                      "relative grid size-10 place-items-center rounded-md text-sm tabular-nums transition-colors",
                      vergangen ? "text-muted-foreground/40" : "hover:bg-muted",
                      tag === heute && !istGewaehlt && "font-semibold text-primary",
                      istGewaehlt && "bg-primary font-medium text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {Number(tag.slice(8))}
                    {belegt > 0 && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          istGewaehlt ? "bg-primary-foreground" : vergangen ? "bg-muted-foreground/40" : "bg-primary",
                        )}
                      />
                    )}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground" aria-live="polite">
        {frei ? (
          `Für den ${datumLangMitWochentag(datum)} ist noch nichts angemeldet.`
        ) : (
          <>
            <span aria-hidden="true" className="mr-2 inline-block size-1 rounded-full bg-primary align-middle" />
            Punkt = schon belegt. Ein Klick übernimmt das Datum.
          </>
        )}
      </p>
    </div>
  );
}

/** Jeder Termin als eigene Karte, nach Monat gegliedert. Der gewählte Tag ist hervorgehoben. */
function Karten({ heute, datum, liste, hoehe }: { heute: string; datum: string; liste: Belegung[]; hoehe?: string }) {
  const nachMonat = useMemo(() => {
    const gruppen: { monat: string; eintraege: Belegung[] }[] = [];
    for (const b of [...liste].sort((a, c) => a.datum.localeCompare(c.datum) || a.beginn.localeCompare(c.beginn))) {
      const monat = b.datum.slice(0, 7);
      const letzte = gruppen[gruppen.length - 1];
      if (letzte && letzte.monat === monat) letzte.eintraege.push(b);
      else gruppen.push({ monat, eintraege: [b] });
    }
    return gruppen;
  }, [liste]);

  return (
    <section aria-label="Alle belegten Termine" className="mt-6 flex min-h-0 flex-1 flex-col border-t border-border pt-4">
      <h3 className="text-[15px] font-semibold">
        Alle Termine <span className="font-normal text-muted-foreground">({liste.length})</span>
      </h3>
      {liste.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Zurzeit hat das Team noch keine Veranstaltung. Alle Tage sind frei.</p>
      ) : (
        <div className={cn("-mr-2 mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2", hoehe)} tabIndex={0} role="region" aria-label="Liste der Termine">
          {nachMonat.map((g) => (
            <div key={g.monat}>
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">{monatTitel(g.monat)}</h4>
              <ul className="space-y-2">
                {g.eintraege.map((b, i) => {
                  const t = datumTeile(b.datum);
                  const gewaehlt = b.datum === datum;
                  return (
                    <li
                      key={`${b.datum}-${b.beginn}-${i}`}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2.5",
                        gewaehlt ? "border-primary/60 bg-primary/5" : "border-border bg-surface",
                      )}
                    >
                      <div className="w-9 shrink-0 text-center leading-none">
                        <p className="text-lg font-semibold tabular-nums">{t.tag}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.wochentag}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">{zeiten(b)}</p>
                        <p className="text-sm text-muted-foreground">{inTagen(b.datum, heute)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
