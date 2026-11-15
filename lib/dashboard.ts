import {
  ARTEN,
  TECH_GROUPS,
  TERMINE,
  fristPruefen,
  type ArtId,
  type FormValues,
} from "./registration.ts";
import { tageZwischen } from "./format.ts";

/*
  Reine Hilfsfunktionen für die Übersicht und die Detailseite des Teams.
  Hier steckt keine Datenbank und kein Server, damit sich alles einfach testen lässt.
*/

export type ZeitAuswahl = "anstehend" | "vergangen" | "alle";

export type Listeneintrag = {
  id: string;
  values: FormValues;
  erstelltAm: string;
  geaendertAm: string;
  dateien: { id: string; name: string; groesse: number; erstelltAm: string }[];
  aenderungen: { zeit: string; felder: string[] }[];
};

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

/** Alle gewählten Punkte, nach Gruppen, mit Anzahl bei Mikrofonen und Headsets. */
export function technikGruppen(v: FormValues): { gruppe: string; punkte: string[] }[] {
  const ergebnis: { gruppe: string; punkte: string[] }[] = [];
  for (const g of TECH_GROUPS) {
    const punkte = g.items
      .filter((item) => v.tech[item.id])
      .map((item) => {
        const anzahl = item.count ? v[item.count].trim() : "";
        return anzahl ? `${item.label} (${anzahl})` : item.label;
      });
    if (punkte.length > 0) ergebnis.push({ gruppe: g.label, punkte });
  }
  return ergebnis;
}

/** Eine Zeile für die Liste, zum Beispiel "Ton (6 Mikrofone), Licht, Bühne". */
export function technikKurz(v: FormValues): string {
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

export function betreuungKurz(v: FormValues): string {
  const wer = [v.betreuung_ton && "Ton", v.betreuung_licht && "Licht"].filter(Boolean);
  return wer.length > 0 ? `Techniker nötig: ${wer.join(" und ")}` : "Ohne Techniker";
}

/* Status ------------------------------------------------------------------- */

/** Wurde mit genügend Vorlauf angemeldet? Verglichen wird mit dem Tag der Anmeldung, nicht mit heute. */
export function fristBeiAnmeldung(v: FormValues, erstelltAm: string) {
  return fristPruefen(v.datum, v.arten, new Date(erstelltAm));
}

export function knappAngemeldet(e: Listeneintrag): { vorhanden: number; noetig: number; art: string } | null {
  const f = fristBeiAnmeldung(e.values, e.erstelltAm);
  return f && f.status === "knapp" ? { vorhanden: f.vorhanden, noetig: f.noetig, art: f.art } : null;
}

/** Die jüngste Änderung, wenn sie höchstens "tage" Tage zurückliegt. */
export function juengsteAenderung(e: Listeneintrag, heuteIso: string, tage = 14) {
  const a = e.aenderungen[0];
  if (!a) return null;
  return tageZwischen(a.zeit.slice(0, 10), heuteIso) <= tage ? a : null;
}

/* Filtern, sortieren, gruppieren -------------------------------------------- */

export type Filter = { zeit: ZeitAuswahl; art?: ArtId | ""; suche?: string };

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
  const anstehend = liste.filter((e) => e.values.datum >= heuteIso);
  return {
    anstehend: anstehend.length,
    knapp: anstehend.filter((e) => knappAngemeldet(e)).length,
    geaendert: anstehend.filter((e) => juengsteAenderung(e, heuteIso, 7)).length,
    ohneUnterlagen: anstehend.filter((e) => e.dateien.length === 0).length,
  };
}

/** Nächste Veranstaltung ab heute, falls es eine gibt. */
export function naechste(liste: Listeneintrag[], heuteIso: string): Listeneintrag | null {
  return filtere(liste, { zeit: "anstehend" }, heuteIso)[0] ?? null;
}
