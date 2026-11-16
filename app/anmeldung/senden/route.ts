import { revalidatePath } from "next/cache";
import { anfrageKontext } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
import { reicheAnmeldungEin } from "@/lib/server/einreichen";
import { antwort, liesFormular } from "@/lib/server/formular-anfrage";

/** So schnell füllt kein Mensch das Formular aus. Schneller ist fast sicher ein Programm. */
const MINDESTDAUER_MS = 4000;

/**
 * Nimmt die Anmeldung einer Lehrkraft an. Öffentlich, ohne Konto.
 * Gegen Programme gibt es ein verstecktes Feld, das Menschen nie ausfüllen, und eine Mindestdauer.
 * Solche Anfragen bekommen dieselbe Erfolgsantwort wie echte, es wird nur nichts gespeichert und nichts verschickt.
 */
export async function POST(anfrage: Request) {
  const gelesen = await liesFormular(anfrage);
  if (!gelesen.ok) return gelesen.antwort;

  const { formular } = gelesen;
  const versteckt = String(formular.get("webseite") ?? "").trim();
  const dauer = Date.now() - Number(formular.get("gestartet"));
  if (versteckt || !(dauer >= MINDESTDAUER_MS)) return antwort({ ok: true, mail: "gesendet" });

  try {
    const ergebnis = await reicheAnmeldungEin({ values: gelesen.values, dateien: gelesen.dateien }, await anfrageKontext());
    if (ergebnis.ok) revalidatePath("/team");
    return antwort(ergebnis, ergebnis.ok ? 200 : ergebnis.meldung?.includes("zu viele") ? 429 : 422);
  } catch (fehler) {
    if (fehler instanceof FachFehler) return antwort({ ok: false, meldung: fehler.message }, 400);
    console.error(fehler);
    return antwort({ ok: false, meldung: "Das Senden hat nicht geklappt. Ihre Angaben sind noch da. Bitte versuchen Sie es noch einmal." }, 500);
  }
}
