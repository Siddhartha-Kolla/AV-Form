import { connection } from "next/server";
import { BELEGUNG_TAGE, type Belegung } from "@/lib/belegung";
import { heuteBerlin } from "@/lib/format";
import { listeBelegung } from "@/lib/server/anmeldungen";

/**
 * Öffentlich, ohne Anmeldung: Die Lehrkräfte sehen im Formular, welche Termine das Team schon hat.
 * Die Antwort enthält nur Datum und Uhrzeit. Weil dafür jede Anmeldung entschlüsselt wird, merkt sich der
 * Server das Ergebnis kurz, so dass häufiges Aufrufen die Datenbank nicht belastet.
 */
const GUELTIG_MS = 30_000;
let merker: { bis: number; tag: string; daten: Belegung[] } | null = null;

export async function GET() {
  await connection();
  const jetzt = Date.now();
  const heute = heuteBerlin();
  if (!merker || merker.bis < jetzt || merker.tag !== heute) {
    const ende = new Date(Date.UTC(+heute.slice(0, 4), +heute.slice(5, 7) - 1, +heute.slice(8, 10) + BELEGUNG_TAGE))
      .toISOString()
      .slice(0, 10);
    merker = { bis: jetzt + GUELTIG_MS, tag: heute, daten: listeBelegung(heute, ende) };
  }
  return Response.json(merker.daten, { headers: { "Cache-Control": "public, max-age=30" } });
}
