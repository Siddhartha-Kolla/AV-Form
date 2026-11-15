/*
  Belegung: Welche Termine hat das Technikteam schon? Das sehen Lehrkräfte beim Anmelden.
  Öffentlich sind nur Datum und Uhrzeit. Titel, Lehrkraft, Ort und Technik bleiben beim Team.
  Reine Funktionen ohne Datenbank, damit sich alles testen lässt.
*/

export type Belegung = { datum: string; beginn: string; ende: string };

/** Wie weit im Voraus die Belegung gezeigt wird, in Tagen. */
export const BELEGUNG_TAGE = 400;

export function nachTag(liste: Belegung[]): Map<string, Belegung[]> {
  const karte = new Map<string, Belegung[]>();
  for (const b of liste) {
    const tag = karte.get(b.datum) ?? [];
    tag.push(b);
    karte.set(b.datum, tag);
  }
  for (const tag of karte.values()) tag.sort((a, b) => a.beginn.localeCompare(b.beginn));
  return karte;
}

/** Überschneiden sich zwei Zeiträume am selben Tag? Aneinander grenzende Zeiten zählen nicht. */
export function ueberschneidet(a: { beginn: string; ende: string }, b: { beginn: string; ende: string }): boolean {
  if (!/^\d{2}:\d{2}$/.test(a.beginn) || !/^\d{2}:\d{2}$/.test(a.ende)) return false;
  return a.beginn < b.ende && b.beginn < a.ende;
}

function tagIso(jahr: number, monat: number, tag: number): string {
  return `${jahr}-${String(monat + 1).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/** Die Wochen eines Monats, Montag zuerst. Tage außerhalb des Monats sind null. "monat" zählt ab 0. */
export function monatsRaster(jahr: number, monat: number): (string | null)[][] {
  const ersterWochentag = (new Date(Date.UTC(jahr, monat, 1)).getUTCDay() + 6) % 7; // Montag = 0
  const tage = new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate();
  const zellen: (string | null)[] = [
    ...Array<null>(ersterWochentag).fill(null),
    ...Array.from({ length: tage }, (_, i) => tagIso(jahr, monat, i + 1)),
  ];
  while (zellen.length % 7 !== 0) zellen.push(null);
  const wochen: (string | null)[][] = [];
  for (let i = 0; i < zellen.length; i += 7) wochen.push(zellen.slice(i, i + 7));
  return wochen;
}

/** Der Monat vor oder nach "jahr/monat". */
export function verschiebeMonat(jahr: number, monat: number, schritt: number): { jahr: number; monat: number } {
  const d = new Date(Date.UTC(jahr, monat + schritt, 1));
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() };
}

/** Passt die Antwort des Servers zur erwarteten Form? Alles andere wird verworfen. */
export function alsBelegungsliste(wert: unknown): Belegung[] | null {
  if (!Array.isArray(wert)) return null;
  const ergebnis: Belegung[] = [];
  for (const b of wert) {
    if (
      b &&
      typeof b.datum === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(b.datum) &&
      typeof b.beginn === "string" &&
      typeof b.ende === "string"
    ) {
      ergebnis.push({ datum: b.datum, beginn: b.beginn, ende: b.ende });
    }
  }
  return ergebnis;
}
