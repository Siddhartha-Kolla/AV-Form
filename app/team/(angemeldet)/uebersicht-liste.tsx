"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, MessageCircleQuestion, Pencil, TriangleAlert, Users, X } from "lucide-react";
import { besetzungText, type EinsatzAuswahl } from "@/lib/besetzung";
import { ARTEN, type ArtId } from "@/lib/registration";
import {
  antwortFehlt,
  betreuungNoetig,
  feldBezeichnung,
  filtere,
  gruppiere,
  juengsteAenderung,
  knappAngemeldet,
  technikKurz,
  unterlagenFehlen,
  type Listeneintrag,
  type StatusAuswahl,
  type ZeitAuswahl,
} from "@/lib/dashboard";
import { STATUS, type StatusId } from "@/lib/entscheidung";
import { datumTeile, inTagen } from "@/lib/format";
import { SelectField, TextField } from "@/components/fields";
import { cn } from "@/lib/utils";

const STATUS_OPTIONEN: { id: StatusAuswahl; text: string }[] = [
  { id: "zeitplan", text: "Im Zeitplan" },
  { id: "neu", text: STATUS.neu.text },
  { id: "rueckfrage", text: STATUS.rueckfrage.text },
  { id: "angenommen", text: STATUS.angenommen.text },
  { id: "abgelehnt", text: STATUS.abgelehnt.text },
  { id: "alle", text: "Alle Status" },
];

const STATUS_ZEILE: Record<StatusId, { symbol: typeof Check; klasse: string }> = {
  neu: { symbol: Clock, klasse: "font-medium text-note-foreground" },
  rueckfrage: { symbol: MessageCircleQuestion, klasse: "font-medium text-note-foreground" },
  angenommen: { symbol: Check, klasse: "text-primary" },
  abgelehnt: { symbol: X, klasse: "text-muted-foreground" },
};

const EINSATZ_OPTIONEN: { id: EinsatzAuswahl; text: string }[] = [
  { id: "alle", text: "Alle" },
  { id: "meine", text: "Meine Einsätze" },
  { id: "offen", text: "Antwort fehlt" },
];

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
  start: { zeit: ZeitAuswahl; art: ArtId | ""; suche: string; status: StatusAuswahl; einsatz: EinsatzAuswahl };
}) {
  const [zeit, setZeit] = useState<ZeitAuswahl>(start.zeit);
  const [art, setArt] = useState<ArtId | "">(start.art);
  const [suche, setSuche] = useState(start.suche);
  const [status, setStatus] = useState<StatusAuswahl>(start.status);
  const [einsatz, setEinsatz] = useState<EinsatzAuswahl>(start.einsatz);

  useEffect(() => {
    const p = new URLSearchParams();
    if (zeit !== "anstehend") p.set("zeit", zeit);
    if (art) p.set("art", art);
    if (status !== "zeitplan") p.set("status", status);
    if (einsatz !== "alle") p.set("einsatz", einsatz);
    if (suche.trim()) p.set("q", suche.trim());
    const text = p.toString();
    window.history.replaceState(null, "", text ? `/team?${text}` : "/team");
  }, [zeit, art, suche, status, einsatz]);

  const sicht = useMemo(
    () => filtere(eintraege, { zeit, art: art || undefined, suche, status, einsatz }, heute),
    [eintraege, zeit, art, suche, status, einsatz, heute],
  );
  const gruppen = useMemo(() => gruppiere(sicht, zeit, heute), [sicht, zeit, heute]);
  const gefiltert = !!(art || suche.trim() || status !== "zeitplan" || einsatz !== "alle");

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
          <SelectField
            id="status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusAuswahl)}
            className="w-full sm:w-48"
          >
            {STATUS_OPTIONEN.map((o) => (
              <option key={o.id} value={o.id}>
                {o.text}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="einsatz"
            label="Einsatz"
            value={einsatz}
            onChange={(e) => setEinsatz(e.target.value as EinsatzAuswahl)}
            className="w-full sm:w-44"
          >
            {EINSATZ_OPTIONEN.map((o) => (
              <option key={o.id} value={o.id}>
                {o.text}
              </option>
            ))}
          </SelectField>
          {gefiltert && (
            <button
              type="button"
              onClick={() => {
                setSuche("");
                setArt("");
                setStatus("zeitplan");
                setEinsatz("alle");
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
  // Abgelehntes steht nicht im Zeitplan: ohne Warnungen und etwas zurückgenommen.
  const abgelehnt = e.status === "abgelehnt";
  const knapp = abgelehnt ? null : knappAngemeldet(e);
  const aenderung = juengsteAenderung(e, heute);
  const fehlen = !abgelehnt && unterlagenFehlen(e, heute);
  const stand = STATUS_ZEILE[e.status];
  const vergangen = v.datum < heute;
  const istHeute = v.datum === heute;
  const datum = datumTeile(v.datum);
  const techniker = betreuungNoetig(v);
  const b = abgelehnt ? undefined : e.besetzung;
  const hatBesetzung = !!b && (b.dabei > 0 || b.pflicht || b.benoetigt !== null);
  const fehltAntwort = antwortFehlt(e, heute);

  const arten: string[] = v.arten.map((id) => ARTEN.find((a) => a.id === id)?.label ?? id);
  if (v.arten.includes("sonstiges") && v.art_sonstiges.trim()) {
    arten[arten.indexOf("Sonstiges")] = v.art_sonstiges.trim();
  }
  const felder = aenderung?.felder.map(feldBezeichnung) ?? [];
  const felderText = felder.length > 3 ? `${felder.slice(0, 3).join(", ")} und ${felder.length - 3} weitere` : felder.join(", ");

  return (
    <li className={cn("relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-5 transition-colors hover:bg-muted/60 md:grid-cols-[4.5rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-6 md:px-3", abgelehnt && "text-muted-foreground")}>
      <div className={cn("leading-none", (vergangen || abgelehnt) && "text-muted-foreground")}>
        <p className={cn("text-[1.75rem] font-semibold tabular-nums tracking-tight", istHeute && "text-primary")}>{datum.tag}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {datum.wochentag} {datum.monat}
        </p>
      </div>

      <div className="min-w-0">
        <Link
          href={`/team/anmeldungen/${e.id}`}
          className={cn("text-base font-semibold leading-snug after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-[3px] focus-visible:after:ring-ring/40", abgelehnt && "font-medium text-muted-foreground line-through decoration-muted-foreground/60")}
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
        {/* Bei Vergangenem ohne Entscheidung wäre "Zu prüfen" nur Rauschen. */}
        {!(vergangen && e.status === "neu") && (
          <li className={cn("flex items-start gap-1.5", stand.klasse)}>
            <stand.symbol className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {STATUS[e.status].text}
              {!vergangen && !abgelehnt && <span className="text-muted-foreground">, {inTagen(v.datum, heute)}</span>}
            </span>
          </li>
        )}
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
        {(hatBesetzung || fehltAntwort) && (
          <li className="flex items-start gap-1.5 text-muted-foreground">
            <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {b?.pflicht && <span className="font-medium text-note-foreground">Pflicht, </span>}
              {hatBesetzung && b && besetzungText(b)}
              {fehltAntwort && (
                <span className="font-medium text-note-foreground">
                  {hatBesetzung ? ", " : ""}
                  Deine Antwort fehlt
                </span>
              )}
            </span>
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
