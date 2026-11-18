import {
  ARTEN,
  TECH_GROUPS,
  TERMINE,
  fristPruefen,
  type ArtId,
  type FormValues,
} from "./registration.ts";
import { monatTitel, tageZwischen } from "./format.ts";
import type { StatusId } from "./entscheidung.ts";
import type { BesetzungKurz, EinsatzAuswahl } from "./besetzung.ts";

/*
  Reine Hilfsfunktionen für die Übersicht und die Detailseite des Teams.
  Hier steckt keine Datenbank und kein Server, damit sich alles einfach testen lässt.
*/

export type ZeitAuswahl = "anstehend" | "vergangen" | "alle";

/** Nur die Felder, die die Übersicht braucht. Mehr verlässt den Server nicht, wenn die Liste im Browser gefiltert wird. */
export type ListenWerte = Pick<
  FormValues,
  | "titel"
  | "lehrkraft"
  | "ort"
  | "datum"
  | "beginn"
  | "ende"
  | "arten"
  | "art_sonstiges"
  | "tech"
  | "mikrofone_anzahl"
  | "betreuung_ton"
  | "betreuung_licht"
>;

export type Listeneintrag = {
  id: string;
  values: ListenWerte;
  status: StatusId;
  erstelltAm: string;
  dateienAnzahl: number;
  aenderungen: { zeit: string; felder: string[] }[];
  /** Wer vom Team dabei ist. Fehlt, wenn die Besetzung nicht geladen wurde. */
  besetzung?: BesetzungKurz;
};

/** Verkleinert eine vollständige Anmeldung auf das, was die Liste zeigt. */
export function alsListeneintrag(a: {
  id: string;
  values: FormValues;
  status: StatusId;
  erstelltAm: string;
  dateien: unknown[];
  aenderungen: { zeit: string; felder: string[] }[];
  besetzung?: BesetzungKurz;
}): Listeneintrag {
  const v = a.values;
  return {
    id: a.id,
    values: {
      titel: v.titel,
      lehrkraft: v.lehrkraft,
      ort: v.ort,
      datum: v.datum,
      beginn: v.beginn,
      ende: v.ende,
      arten: v.arten,
      art_sonstiges: v.art_sonstiges,
      tech: v.tech,
      mikrofone_anzahl: v.mikrofone_anzahl,
      betreuung_ton: v.betreuung_ton,
      betreuung_licht: v.betreuung_licht,
    },
    status: a.status,
    erstelltAm: a.erstelltAm,
    dateienAnzahl: a.dateien.length,
    // Nur Zeit und Feldnamen, nie Namen oder Notizen der Bearbeiter
    aenderungen: a.aenderungen.map(({ zeit, felder }) => ({ zeit, felder })),
    besetzung: a.besetzung,
  };
}

/* Beschriftungen ----------------------------------------------------------- */

const FELDER: Record<string, string> = {
  titel: "Titel",
  lehrkraft: "Lehrkraft",
  email: "E-Mail",
  datum: "Datum",
  beginn: "Beginn",
  ende: "Ende",
  ort: "Ort",
  arten: "Art",
  art_sonstiges: "Art (Sonstiges)",
  tech: "Technik",
  mikrofone_anzahl: "Anzahl Mikrofone",
  headsets_anzahl: "Anzahl Headsets",
  betreuung_ton: "Betreuung Ton",
  betreuung_licht: "Betreuung Licht",
  technische_details: "Technische Details",
  anmerkungen: "Anmerkungen",
};

export function feldBezeichnung(key: string): string {
  if (key === "datei+") return "Datei hinzugefügt";
  if (key === "datei-") return "Datei entfernt";
  if (key.startsWith("termine.")) {
    const termin = TERMINE.find((t) => t.id === key.slice("termine.".length));
    return termin ? `Termin ${termin.label}` : "Termine";
  }
  return FELDER[key] ?? key;
}

export function artBezeichnung(id: string): string {
  return ARTEN.find((a) => a.id === id)?.label ?? id;
}

/* Technik und Betreuung ---------------------------------------------------- */

/** Punkte, die nur sagen, dass nichts gebraucht wird. Sie zählen nicht als Technik. */
const KEINE_TECHNIK = new Set(["ton_kein", "licht_raumlicht"]);

export type TechnikPunkt = { text: string; anzahl: string | null };

/** Alle gewählten Punkte, nach Gruppen. Bei Mikrofonen und Headsets steht die Anzahl getrennt. */
export function technikGruppen(v: FormValues): { gruppe: string; punkte: TechnikPunkt[] }[] {
  const ergebnis: { gruppe: string; punkte: TechnikPunkt[] }[] = [];
  for (const g of TECH_GROUPS) {
    const punkte = g.items
      .filter((item) => v.tech[item.id])
      .map((item): TechnikPunkt => ({ text: item.label, anzahl: item.count ? v[item.count].trim() || null : null }));
    if (punkte.length > 0) ergebnis.push({ gruppe: g.label, punkte });
  }
  return ergebnis;
}

/** Eine Zeile für die Liste, zum Beispiel "Ton (6 Mikrofone), Licht, Bühne". */
export function technikKurz(v: ListenWerte): string {
  const teile: string[] = [];
  for (const g of TECH_GROUPS) {
    const gewaehlt = g.items.filter((item) => v.tech[item.id] && !KEINE_TECHNIK.has(item.id));
    if (gewaehlt.length === 0) continue;
    const mikrofone = g.id === "ton" && v.tech.mikrofone && v.mikrofone_anzahl.trim();
    teile.push(mikrofone ? `${g.label} (${v.mikrofone_anzahl.trim()} Mikrofone)` : g.label);
  }
  if (teile.length > 0) return teile.join(", ");
  const nurRaumlicht = Object.entries(v.tech).some(([k, an]) => an && KEINE_TECHNIK.has(k));
  return nurRaumlicht ? "Keine zusätzliche Technik" : "Keine Technik angegeben";
}

/** "Ton und Licht", wenn Techniker gebraucht werden, sonst null. */
export function betreuungNoetig(v: ListenWerte): string | null {
  const wer = [v.betreuung_ton && "Ton", v.betreuung_licht && "Licht"].filter(Boolean);
  return wer.length > 0 ? wer.join(" und ") : null;
}

export function betreuungKurz(v: ListenWerte): string {
  const wer = [v.betreuung_ton && "Ton", v.betreuung_licht && "Licht"].filter(Boolean);
  return wer.length > 0 ? `Techniker nötig: ${wer.join(" und ")}` : "Ohne Techniker";
}

/* Status ------------------------------------------------------------------- */

/** Wurde mit genügend Vorlauf angemeldet? Verglichen wird mit dem Tag der Anmeldung, nicht mit heute. */
export function fristBeiAnmeldung(v: Pick<FormValues, "datum" | "arten">, erstelltAm: string) {
  return fristPruefen(v.datum, v.arten, new Date(erstelltAm));
}

export function knappAngemeldet(e: Listeneintrag): { vorhanden: number; noetig: number; art: string } | null {
  const f = fristBeiAnmeldung(e.values, e.erstelltAm);
  return f && f.status === "knapp" ? { vorhanden: f.vorhanden, noetig: f.noetig, art: f.art } : null;
}

/**
 * Fehlen Unterlagen, obwohl die Veranstaltung bald ist? Bei Sonstigem gibt es nichts Bestimmtes zu erwarten,
 * deshalb zählen nur Arten mit festen Unterlagen. "tage" ist der Vorlauf, ab dem der Hinweis erscheint.
 */
export function unterlagenFehlen(e: Listeneintrag, heuteIso: string, tage = 21): boolean {
  if (e.dateienAnzahl > 0) return false;
  if (!e.values.arten.some((a) => a !== "sonstiges")) return false;
  const bis = tageZwischen(heuteIso, e.values.datum);
  return bis >= 0 && bis <= tage;
}

/** Die jüngste Änderung, wenn sie höchstens "tage" Tage zurückliegt. */
export function juengsteAenderung(e: Listeneintrag, heuteIso: string, tage = 14) {
  const a = e.aenderungen[0];
  if (!a) return null;
  return tageZwischen(a.zeit.slice(0, 10), heuteIso) <= tage ? a : null;
}

/* Filtern, sortieren, gruppieren -------------------------------------------- */

/** "zeitplan" blendet Abgelehntes aus, "alle" zeigt wirklich alles. */
export type StatusAuswahl = "zeitplan" | StatusId | "alle";

export function istStatusAuswahl(wert: string): wert is StatusAuswahl {
  return wert === "zeitplan" || wert === "alle" || wert === "neu" || wert === "angenommen" || wert === "rueckfrage" || wert === "abgelehnt";
}

export type Filter = { zeit: ZeitAuswahl; art?: ArtId | ""; suche?: string; status?: StatusAuswahl; einsatz?: EinsatzAuswahl };

/** Fehlt dem Mitglied noch eine Antwort? Nur bei Veranstaltungen, die noch gelten und anstehen. */
export function antwortFehlt(e: Listeneintrag, heuteIso: string): boolean {
  return e.status !== "abgelehnt" && e.values.datum >= heuteIso && e.besetzung?.meine === "offen";
}

export function istArt(wert: string): wert is ArtId {
  return ARTEN.some((a) => a.id === wert);
}

export function filtere(liste: Listeneintrag[], filter: Filter, heuteIso: string): Listeneintrag[] {
  const suche = (filter.suche ?? "").trim().toLowerCase();
  const treffer = liste.filter((e) => {
    const v = e.values;
    if (filter.zeit === "anstehend" && v.datum < heuteIso) return false;
    if (filter.zeit === "vergangen" && v.datum >= heuteIso) return false;
    if (filter.art && !v.arten.includes(filter.art)) return false;
    const status = filter.status ?? "zeitplan";
    if (status === "zeitplan" ? e.status === "abgelehnt" : status !== "alle" && e.status !== status) return false;
    if (filter.einsatz === "meine" && e.besetzung?.meine !== "dabei") return false;
    if (filter.einsatz === "offen" && !antwortFehlt(e, heuteIso)) return false;
    if (suche) {
      const heuhaufen = [v.titel, v.lehrkraft, v.ort, v.art_sonstiges].join(" ").toLowerCase();
      if (!suche.split(/\s+/).every((wort) => heuhaufen.includes(wort))) return false;
    }
    return true;
  });
  const aufsteigend = filter.zeit === "anstehend";
  return treffer.sort((a, b) => {
    const vergleich = a.values.datum.localeCompare(b.values.datum) || a.values.beginn.localeCompare(b.values.beginn);
    return aufsteigend ? vergleich : -vergleich;
  });
}

/** Gruppiert die (schon sortierte) Liste nach Monat, in der Reihenfolge des ersten Auftretens. */
export function nachMonat(liste: Listeneintrag[]): { monat: string; eintraege: Listeneintrag[] }[] {
  const gruppen: { monat: string; eintraege: Listeneintrag[] }[] = [];
  for (const e of liste) {
    const monat = e.values.datum.slice(0, 7);
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.monat === monat) letzte.eintraege.push(e);
    else gruppen.push({ monat, eintraege: [e] });
  }
  return gruppen;
}

export function zusammenfassung(liste: Listeneintrag[], heuteIso: string) {
  // Abgelehntes steht nicht im Zeitplan und zählt nirgends mit.
  const anstehend = liste.filter((e) => e.values.datum >= heuteIso && e.status !== "abgelehnt");
  return {
    anstehend: anstehend.length,
    zuPruefen: anstehend.filter((e) => e.status === "neu").length,
    rueckfragen: anstehend.filter((e) => e.status === "rueckfrage").length,
    knapp: anstehend.filter((e) => knappAngemeldet(e)).length,
    geaendert: anstehend.filter((e) => juengsteAenderung(e, heuteIso, 7)).length,
    ohneUnterlagen: anstehend.filter((e) => e.dateienAnzahl === 0).length,
    antwortFehlt: anstehend.filter((e) => antwortFehlt(e, heuteIso)).length,
  };
}


export type Gruppe = { schluessel: string; titel: string; eintraege: Listeneintrag[] };

/** Montag der Woche als UTC-Tag in Millisekunden. */
function wochenStart(iso: string): number {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number);
  const tag = Date.UTC(j, m - 1, t);
  const wochentag = (new Date(tag).getUTCDay() + 6) % 7; // Montag = 0
  return tag - wochentag * 86_400_000;
}

/**
 * Anstehendes wird nach Wochen sortiert gezeigt: "Diese Woche", "Nächste Woche", danach nach Monat.
 * Vergangenes und "Alle" werden nach Monat gruppiert.
 */
export function gruppiere(liste: Listeneintrag[], zeit: ZeitAuswahl, heuteIso: string): Gruppe[] {
  if (zeit !== "anstehend") {
    return nachMonat(liste).map((g) => ({ schluessel: g.monat, titel: monatTitel(g.monat), eintraege: g.eintraege }));
  }
  const gruppen: Gruppe[] = [];
  for (const e of liste) {
    const wochen = Math.round((wochenStart(e.values.datum) - wochenStart(heuteIso)) / (7 * 86_400_000));
    const [schluessel, titel] =
      wochen <= 0
        ? ["woche-0", "Diese Woche"]
        : wochen === 1
          ? ["woche-1", "Nächste Woche"]
          : [e.values.datum.slice(0, 7), monatTitel(e.values.datum.slice(0, 7))];
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte.schluessel === schluessel) letzte.eintraege.push(e);
    else gruppen.push({ schluessel, titel, eintraege: [e] });
  }
  return gruppen;
}

/* Termine ------------------------------------------------------------------- */

export type TerminZeile = {
  id: string;
  label: string;
  /** Ein echtes Datum, wenn sich der Eintrag einordnen lässt, sonst null (freier Text). */
  datum: string | null;
  datumText: string;
  uhrzeit: string;
  ort: string;
  zusatz: string;
  haupt: boolean;
};

/**
 * Alle Termine rund um die Veranstaltung in zeitlicher Reihenfolge. Die Veranstaltung selbst kommt aus
 * den Hauptfeldern. Einträge mit freiem Text statt Datum (zum Beispiel mehrere Proben) stehen am Anfang.
 */
export function terminListe(v: FormValues): TerminZeile[] {
  const zeilen: TerminZeile[] = [];
  for (const t of TERMINE) {
    const x = v.termine[t.id];
    if (t.id === "veranstaltung") {
      zeilen.push({
        id: t.id,
        label: t.label,
        datum: v.datum,
        datumText: v.datum,
        uhrzeit: `${v.beginn} bis ${v.ende} Uhr`,
        ort: v.ort,
        zusatz: [x.datum && !/^\d{4}-/.test(x.datum) ? x.datum : "", x.uhrzeit, x.ort].filter(Boolean).join(", "),
        haupt: true,
      });
      continue;
    }
    if (!x.datum && !x.uhrzeit && !x.ort) continue;
    const echt = /^\d{4}-\d{2}-\d{2}$/.test(x.datum);
    zeilen.push({
      id: t.id,
      label: t.label,
      datum: echt ? x.datum : null,
      datumText: x.datum,
      uhrzeit: /^\d{2}:\d{2}$/.test(x.uhrzeit) ? `${x.uhrzeit} Uhr` : x.uhrzeit,
      ort: x.ort,
      zusatz: "",
      haupt: false,
    });
  }
  return zeilen.sort((a, b) => {
    if (a.datum === null && b.datum !== null) return -1;
    if (a.datum !== null && b.datum === null) return 1;
    if (a.datum === null || b.datum === null) return 0;
    return a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit);
  });
}

/* Änderungen vergleichen ------------------------------------------------------ */

const FELDER_MIT_UNTERPUNKTEN = ["termine"] as const;

/** Namen der Formularfelder, die sich unterscheiden. Termine werden pro Zeile genannt. */
export function geaenderteFelder(alt: FormValues, neu: FormValues): string[] {
  const unterschied: string[] = [];
  for (const key of Object.keys(neu) as (keyof FormValues)[]) {
    if ((FELDER_MIT_UNTERPUNKTEN as readonly string[]).includes(key)) {
      const a = alt[key] as Record<string, unknown>;
      const n = neu[key] as Record<string, unknown>;
      for (const unter of Object.keys(n)) {
        if (JSON.stringify(a?.[unter]) !== JSON.stringify(n[unter])) unterschied.push(`${key}.${unter}`);
      }
    } else if (JSON.stringify(alt[key]) !== JSON.stringify(neu[key])) {
      unterschied.push(key);
    }
  }
  return unterschied;
}
