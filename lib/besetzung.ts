/*
  Besetzung: Wer vom Team bei einer Veranstaltung dabei ist. Reine Funktionen ohne Datenbank,
  damit Übersicht, Detailseite und Tests dasselbe benutzen.

  Jedes aktive Teammitglied beantwortet für jede Veranstaltung, die noch gilt, "Dabei" oder "Nicht dabei".
  Wer noch nichts gesagt hat, ist "Offen". Einen Eintrag für "Offen" gibt es nicht, er ergibt sich aus dem Fehlen.
  Ein Admin kann eine Veranstaltung zur Pflicht machen und festlegen, wie viele Leute gebraucht werden.
  Bei einer Pflicht muss, wer nicht dabei sein kann, kurz sagen warum.
*/

export type Antwort = "dabei" | "nicht_dabei";
export type MeineAntwort = Antwort | "offen";

export const ANTWORT_TEXT: Record<MeineAntwort, string> = {
  dabei: "Dabei",
  nicht_dabei: "Nicht dabei",
  offen: "Offen",
};

export const MAX_NOTIZ = 200;
export const MAX_BENOETIGT = 50;

export function istAntwort(wert: unknown): wert is Antwort {
  return wert === "dabei" || wert === "nicht_dabei";
}

/** Filter der Übersicht: alle, nur die eigenen Einsätze oder nur das, was für mich noch offen ist. */
export type EinsatzAuswahl = "alle" | "meine" | "offen";

export function istEinsatzAuswahl(wert: string): wert is EinsatzAuswahl {
  return wert === "alle" || wert === "meine" || wert === "offen";
}

/** Der Stand einer Veranstaltung in Zahlen, so wie die Übersicht ihn braucht. */
export type BesetzungKurz = {
  pflicht: boolean;
  benoetigt: number | null;
  dabei: number;
  nichtDabei: number;
  offen: number;
  /** Die Antwort des Mitglieds, das die Seite ansieht. */
  meine: MeineAntwort;
};

export function zaehle(personen: { antwort: MeineAntwort }[]): { dabei: number; nichtDabei: number; offen: number } {
  return {
    dabei: personen.filter((p) => p.antwort === "dabei").length,
    nichtDabei: personen.filter((p) => p.antwort === "nicht_dabei").length,
    offen: personen.filter((p) => p.antwort === "offen").length,
  };
}

/** "3 von 4 dabei", sonst "2 dabei" oder "Noch niemand dabei". */
export function besetzungText(b: Pick<BesetzungKurz, "dabei" | "benoetigt">): string {
  if (b.benoetigt !== null) return `${b.dabei} von ${b.benoetigt} dabei`;
  return b.dabei === 0 ? "Noch niemand dabei" : `${b.dabei} dabei`;
}

/** Wie viele noch fehlen. Ohne festgelegte Zahl gibt es kein Fehlen. */
export function fehlend(b: Pick<BesetzungKurz, "dabei" | "benoetigt">): number {
  return b.benoetigt === null ? 0 : Math.max(0, b.benoetigt - b.dabei);
}

/** Prüft eine Antwort samt Notiz. Gibt eine Fehlermeldung zurück oder null. */
export function pruefeAntwort(antwort: unknown, notiz: string, pflicht: boolean): string | null {
  if (!istAntwort(antwort)) return "Diese Antwort gibt es nicht.";
  if (notiz.length > MAX_NOTIZ) return `Die Notiz darf höchstens ${MAX_NOTIZ} Zeichen lang sein.`;
  if (antwort === "nicht_dabei" && pflicht && !notiz.trim()) return "Bitte schreibe kurz, warum du nicht dabei sein kannst.";
  return null;
}

/** Die Zahl der benötigten Leute: leer heißt "nicht festgelegt", sonst eine ganze Zahl von 1 bis MAX_BENOETIGT. */
export function pruefeBenoetigt(wert: unknown): { ok: true; benoetigt: number | null } | { ok: false; meldung: string } {
  if (wert === null || wert === undefined || wert === "") return { ok: true, benoetigt: null };
  const n = typeof wert === "number" ? wert : Number(String(wert).trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_BENOETIGT) {
    return { ok: false, meldung: `Die Zahl der benötigten Leute muss zwischen 1 und ${MAX_BENOETIGT} liegen.` };
  }
  return { ok: true, benoetigt: n };
}

/** Bei abgelehnten und vergangenen Veranstaltungen gibt es nichts mehr zu besetzen. Gibt den Grund zurück oder null. */
export function besetzungGesperrt(status: string, datum: string, heuteIso: string): string | null {
  if (status === "abgelehnt") return "Diese Anmeldung wurde abgelehnt, dafür braucht es keine Besetzung.";
  if (datum < heuteIso) return "Die Veranstaltung liegt in der Vergangenheit.";
  return null;
}
