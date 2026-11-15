import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ERLAUBTE_ENDUNGEN, MAX_DATEIEN, MAX_DATEI_MB } from "../registration.ts";
import { dateienDir } from "./config.ts";
import { entschluesseln, neueId, verschluesseln } from "./crypto.ts";
import { db } from "./db.ts";

export type DateiInfo = { id: string; name: string; groesse: number; erstelltAm: string };

const ID_FORM = /^[0-9a-f]{32}$/;

function pfad(dateiId: string): string {
  if (!ID_FORM.test(dateiId)) throw new Error("Ungültige Datei-ID.");
  return path.join(dateienDir(), `${dateiId}.bin`);
}

/** Entfernt Pfadanteile und Steuerzeichen. Der Name wird nie als Pfad benutzt, nur angezeigt. */
function sauberer(name: string): string {
  const nurName = name.replace(/\\/g, "/").split("/").pop() ?? "";
  return nurName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
}

export function speichereDatei(anmeldungId: string, name: string, inhalt: Buffer): DateiInfo {
  const sauber = sauberer(name);
  const endung = sauber.split(".").pop()?.toLowerCase() ?? "";
  if (!sauber || !ERLAUBTE_ENDUNGEN.includes(endung)) {
    throw new Error("Dieser Dateityp wird nicht angenommen.");
  }
  if (inhalt.length === 0) throw new Error("Die Datei ist leer.");
  if (inhalt.length > MAX_DATEI_MB * 1024 * 1024) {
    throw new Error(`Die Datei ist größer als ${MAX_DATEI_MB} MB.`);
  }
  const vorhanden = db()
    .prepare("SELECT COUNT(*) AS n FROM dateien WHERE anmeldung_id = ?")
    .get(anmeldungId) as { n: number };
  if (vorhanden.n >= MAX_DATEIEN) throw new Error(`Es sind höchstens ${MAX_DATEIEN} Dateien möglich.`);

  const id = neueId();
  const ziel = pfad(id);
  const temp = `${ziel}.tmp`;
  fs.writeFileSync(temp, verschluesseln(inhalt, `datei:${id}`), { mode: 0o600 });
  fs.renameSync(temp, ziel);

  const erstelltAm = new Date().toISOString();
  try {
    db()
      .prepare("INSERT INTO dateien (id, anmeldung_id, name, groesse, erstellt_am) VALUES (?, ?, ?, ?, ?)")
      .run(id, anmeldungId, verschluesseln(sauber, `dateiname:${id}`), inhalt.length, erstelltAm);
  } catch (fehler) {
    fs.rmSync(ziel, { force: true });
    throw fehler;
  }
  return { id, name: sauber, groesse: inhalt.length, erstelltAm };
}

type DateiZeile = { id: string; name: Buffer; groesse: number; erstellt_am: string };

function zuInfo(z: DateiZeile): DateiInfo {
  return {
    id: z.id,
    name: entschluesseln(z.name, `dateiname:${z.id}`).toString("utf8"),
    groesse: z.groesse,
    erstelltAm: z.erstellt_am,
  };
}

export function listeDateien(anmeldungId: string): DateiInfo[] {
  const zeilen = db()
    .prepare("SELECT id, name, groesse, erstellt_am FROM dateien WHERE anmeldung_id = ? ORDER BY erstellt_am, id")
    .all(anmeldungId) as DateiZeile[];
  return zeilen.map(zuInfo);
}

/** Liefert die Datei nur, wenn sie zu dieser Anmeldung gehört. */
export function leseDatei(anmeldungId: string, dateiId: string): { info: DateiInfo; inhalt: Buffer } | null {
  if (!ID_FORM.test(dateiId)) return null;
  const zeile = db()
    .prepare("SELECT id, name, groesse, erstellt_am FROM dateien WHERE id = ? AND anmeldung_id = ?")
    .get(dateiId, anmeldungId) as DateiZeile | undefined;
  if (!zeile) return null;
  const inhalt = entschluesseln(fs.readFileSync(pfad(dateiId)), `datei:${dateiId}`);
  return { info: zuInfo(zeile), inhalt };
}

export function loescheDatei(anmeldungId: string, dateiId: string): boolean {
  if (!ID_FORM.test(dateiId)) return false;
  const ergebnis = db().prepare("DELETE FROM dateien WHERE id = ? AND anmeldung_id = ?").run(dateiId, anmeldungId);
  if (ergebnis.changes > 0) fs.rmSync(pfad(dateiId), { force: true });
  return ergebnis.changes > 0;
}

/** Löscht die Dateien auf der Platte. Die Zeilen verschwinden über ON DELETE CASCADE. */
export function entferneDateienVonDisk(anmeldungId: string): void {
  const ids = db().prepare("SELECT id FROM dateien WHERE anmeldung_id = ?").all(anmeldungId) as { id: string }[];
  for (const { id } of ids) fs.rmSync(pfad(id), { force: true });
}
