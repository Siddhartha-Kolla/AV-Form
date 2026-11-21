import { anfrageKontext } from "@/lib/server/auth/dal";
import { antwort, aufDieserSeite } from "@/lib/server/formular-anfrage";
import { fordereZugangslinksAn } from "@/lib/server/zugangslink";

/** So schnell tippt kein Mensch eine Adresse und sendet ab. Schneller ist fast sicher ein Programm. */
const MINDESTDAUER_MS = 1000;

/**
 * "Link verloren": nimmt eine E-Mail-Adresse an. Öffentlich, ohne Konto.
 * Die Antwort ist bei jeder gültigen Adresse gleich. Programme (verstecktes Feld, zu schnell) bekommen
 * dieselbe Antwort, es passiert nur nichts.
 */
export async function POST(anfrage: Request) {
  if (!aufDieserSeite(anfrage)) return antwort({ ok: false, meldung: "Die Anfrage kommt nicht von dieser Seite." }, 403);
  const laenge = Number(anfrage.headers.get("content-length"));
  if (!Number.isFinite(laenge) || laenge <= 0 || laenge > 2000) return antwort({ ok: false, meldung: "Die Anfrage ließ sich nicht lesen." }, 400);

  let daten: { email?: unknown; webseite?: unknown; gestartet?: unknown };
  try {
    daten = await anfrage.json();
  } catch {
    return antwort({ ok: false, meldung: "Die Anfrage ließ sich nicht lesen." }, 400);
  }
  if (typeof daten?.email !== "string") return antwort({ ok: false, meldung: "Bitte geben Sie eine gültige E-Mail-Adresse ein." }, 422);

  const versteckt = typeof daten.webseite === "string" ? daten.webseite.trim() : "x";
  if (versteckt || !(Date.now() - Number(daten.gestartet) >= MINDESTDAUER_MS)) return antwort({ ok: true });

  try {
    const ergebnis = await fordereZugangslinksAn(daten.email, await anfrageKontext());
    if (!ergebnis.ok) return antwort({ ok: false, meldung: ergebnis.meldung }, ergebnis.gedrosselt ? 429 : 422);
    return antwort({ ok: true });
  } catch (fehler) {
    console.error(fehler);
    return antwort({ ok: false, meldung: "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal." }, 500);
  }
}
