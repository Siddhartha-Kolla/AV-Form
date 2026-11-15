import "server-only";
import path from "node:path";

/** Ordner für Datenbank und Dateien. Gehört außerhalb des Web-Roots und nie ins Repo. */
export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR || "./data");
}

export function dateienDir(): string {
  return path.join(dataDir(), "dateien");
}

/** Vorschlag: sechs Monate nach der Veranstaltung. Mit der Schule festlegen. */
export function aufbewahrungMonate(): number {
  const n = Number(process.env.RETENTION_MONTHS ?? 6);
  return Number.isInteger(n) && n >= 1 ? n : 6;
}
