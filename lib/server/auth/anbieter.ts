import "server-only";
import { aktiveAnbieterIds } from "../config.ts";

/*
  Anmeldeanbieter. Jede Anmeldemethode ist ein Anbieter mit einer Kennung.

  Es gibt zwei Arten:
  - "formular": Die Oberfläche zeigt ein Formular, der Anbieter prüft die Eingaben
    (Passwort, später zum Beispiel LDAP).
  - "weiterleitung": Die Person geht zu einem fremden Dienst und kommt zurück
    (OpenID Connect, SAML). Dafür gibt es beginnen() und abschliessen().

  Ein Anbieter beantwortet nur eine Frage: Wer ist das? Die Antwort ist eine Kennung
  (subjekt) bei diesem Anbieter. Welches Konto dazugehört, regelt die Tabelle "identitaeten".
  Sitzungen, Sperren, Drosselung und Protokoll bleiben für alle Anbieter gleich.

  Neuen Anbieter ergänzen:
  1. Datei anlegen, die einen AnmeldeAnbieter exportiert.
  2. In anbieter-register.ts eintragen.
  3. Die Kennung in AUTH_ANBIETER aktivieren.
  4. Konten mit verknuepfeIdentitaet() verknüpfen.
*/

export type AnbieterErgebnis = { subjekt: string; email?: string; name?: string };

export interface AnmeldeAnbieter {
  id: string;
  /** Beschriftung auf der Anmeldeseite. */
  anzeige: string;
  art: "formular" | "weiterleitung";
  /** Nur "formular": prüft die Eingaben. null heißt: nicht erkannt. */
  pruefen?(eingabe: Record<string, string>): Promise<AnbieterErgebnis | null>;
  /** Nur "weiterleitung": liefert die Adresse des fremden Dienstes. */
  beginnen?(optionen: { rueckkehrUrl: string; zustand: string }): Promise<{ url: string }>;
  /** Nur "weiterleitung": wertet die Rückkehr aus. */
  abschliessen?(optionen: { parameter: URLSearchParams; zustand: string }): Promise<AnbieterErgebnis | null>;
}

const register = new Map<string, AnmeldeAnbieter>();

export function registriereAnbieter(anbieter: AnmeldeAnbieter): void {
  register.set(anbieter.id, anbieter);
}

export function holeAnbieter(id: string): AnmeldeAnbieter | null {
  return aktiveAnbieterIds().includes(id) ? (register.get(id) ?? null) : null;
}

export function aktiveAnbieter(): AnmeldeAnbieter[] {
  return aktiveAnbieterIds()
    .map((id) => register.get(id))
    .filter((a): a is AnmeldeAnbieter => !!a);
}
