import "server-only";
import path from "node:path";

/** Ordner für Datenbank und Dateien. Gehört außerhalb des Web-Roots und nie ins Repo. */
export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "./data");
}

export function dateienDir(): string {
  return path.join(dataDir(), "dateien");
}

/** Vorschlag: sechs Monate nach der Veranstaltung. Mit der Schule festlegen. */
export function aufbewahrungMonate(): number {
  const n = Number(process.env.RETENTION_MONTHS ?? 6);
  return Number.isInteger(n) && n >= 1 ? n : 6;
}

/** Aufbewahrung des Protokolls in Tagen (Vorschlag, mit dem Datenschutzbeauftragten abstimmen). */
export function aufbewahrungProtokollTage(): number {
  const n = Number(process.env.PROTOKOLL_AUFBEWAHRUNG_TAGE ?? 180);
  return Number.isInteger(n) && n >= 1 ? n : 180;
}

/** Eine Sitzung endet nach so vielen Stunden ohne Aktivität ... */
export const SITZUNG_LEERLAUF_STUNDEN = 8;
/** ... und spätestens nach so vielen Tagen, egal wie aktiv sie war. */
export const SITZUNG_MAX_TAGE = 7;

/** Nur hinter einem eigenen Reverse Proxy auf 1 setzen, sonst lässt sich die IP-Adresse fälschen. */
export function proxyVertrauen(): boolean {
  return process.env.TRUST_PROXY === "1";
}

/** Aktive Anmeldeanbieter, durch Komma getrennt. Standard: nur Passwort. */
export function aktiveAnbieterIds(): string[] {
  return (process.env.AUTH_ANBIETER ?? "passwort")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
