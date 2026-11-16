import "server-only";
import { geaenderteFelder } from "../dashboard.ts";
import { parseFormValues, validate, type Fehler } from "../registration.ts";
import { aktualisiereAnmeldung, findeNachId } from "./anmeldungen.ts";
import { FachFehler } from "./auth/fehler.ts";
import { listeDateien, loescheDatei, pruefeUpload, speichereDatei, type DateiInfo } from "./dateien.ts";

/*
  Der gemeinsame Kern fürs Bearbeiten einer Anmeldung. Das Team und die Lehrkraft (über ihren privaten Link)
  benutzen denselben Weg: Prüfen, Dateien entfernen und hinzufügen, Verlauf schreiben, alles in einem Schritt.
  Wer darf, entscheidet der Aufrufer. Hier wird nur geprüft, ob das Ergebnis in Ordnung ist.
*/

export type BearbeitenEingabe = {
  /** Die Anmeldung, wie sie im Browser vorliegt. Wird geprüft und bereinigt. */
  values: unknown;
  /** Stand, auf dem die Bearbeitung beruht. */
  revision: number;
  notiz: string;
  entferneDateiIds: string[];
  neueDateien: { name: string; inhalt: Buffer }[];
};

export type BearbeitenErgebnis =
  | { ok: true; geaendert: string[]; titel: string; dateienHinzu: number; dateienEntfernt: number }
  | { ok: false; meldung?: string; fehler?: Fehler; dateiFehler?: string[] };

const VERALTET = "Diese Anmeldung wurde inzwischen geändert. Die Seite bitte neu laden, damit nichts überschrieben wird.";

/**
 * "akteur" ist null, wenn die Lehrkraft selbst ändert. Dann geht eine angenommene Anmeldung zurück auf
 * "Zu prüfen". "heute" ist null beim Team, das auch vergangene Termine bearbeiten darf.
 */
export function wendeBearbeitungAn(
  id: string,
  akteur: { id: string; name: string } | null,
  eingabe: BearbeitenEingabe,
  heute: Date | null,
): BearbeitenErgebnis {
  const alt = findeNachId(id);
  if (!alt) return { ok: false, meldung: "Diese Anmeldung gibt es nicht mehr." };
  if (alt.revision !== eingabe.revision) return { ok: false, meldung: VERALTET };

  const geparst = parseFormValues(eingabe.values);
  if (!geparst.ok) return { ok: false, meldung: geparst.meldung };
  const fehler = validate(geparst.values, heute);
  if (Object.keys(fehler).length > 0) return { ok: false, fehler };

  // Dateien vorab prüfen
  const bestehend = listeDateien(id);
  const weg = new Set(eingabe.entferneDateiIds);
  const unbekannt = [...weg].filter((d) => !bestehend.some((b) => b.id === d));
  const dateiFehler = pruefeUpload(eingabe.neueDateien, bestehend.length - weg.size);
  if (unbekannt.length > 0) dateiFehler.unshift("Eine der zu entfernenden Dateien gibt es nicht mehr. Die Seite bitte neu laden.");
  if (dateiFehler.length > 0) return { ok: false, dateiFehler };

  const titel = geparst.values.titel;
  const felder = geaenderteFelder(alt.values, geparst.values);
  if (felder.length === 0 && weg.size === 0 && eingabe.neueDateien.length === 0) {
    return { ok: true, geaendert: [], titel, dateienHinzu: 0, dateienEntfernt: 0 };
  }

  // Neue Dateien zuerst anlegen. Scheitert das Speichern danach, werden sie wieder entfernt.
  const angelegt: DateiInfo[] = [];
  try {
    for (const d of eingabe.neueDateien) angelegt.push(speichereDatei(id, d.name, d.inhalt, { anzahlSchonGeprueft: true }));
    const ergebnis = aktualisiereAnmeldung(id, geparst.values, {
      akteur,
      notiz: eingabe.notiz.slice(0, 500),
      erwarteteRevision: eingabe.revision,
      dateienHinzu: angelegt.map((a) => a.name),
      dateienWeg: bestehend.filter((b) => weg.has(b.id)).map((b) => b.name),
    });
    if (!ergebnis) throw new FachFehler("Diese Anmeldung gibt es nicht mehr.");
    for (const dateiId of weg) loescheDatei(id, dateiId);
    return { ok: true, geaendert: ergebnis.geaendert, titel, dateienHinzu: angelegt.length, dateienEntfernt: weg.size };
  } catch (fehler) {
    for (const a of angelegt) loescheDatei(id, a.id);
    if (fehler instanceof FachFehler) return { ok: false, meldung: fehler.message };
    throw fehler;
  }
}
