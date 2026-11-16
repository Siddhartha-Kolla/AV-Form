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

/* E-Mail ------------------------------------------------------------------- */

/** Öffentliche Adresse der Seite, ohne Schrägstrich am Ende. Links in E-Mails beginnen damit. */
export function appUrl(): string | null {
  const wert = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (wert) return wert;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

export type SmtpEinstellungen = {
  host: string;
  port: number;
  secure: boolean;
  benutzer: string | null;
  passwort: string | null;
  absender: string;
};

/** Null, solange kein SMTP-Server eingetragen ist. */
export function smtpEinstellungen(): SmtpEinstellungen | null {
  const host = process.env.SMTP_HOST?.trim();
  const absender = process.env.MAIL_FROM?.trim();
  if (!host || !absender) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host,
    port: Number.isInteger(port) && port > 0 ? port : 587,
    // Port 465 spricht von Anfang an verschlüsselt, alle anderen starten unverschlüsselt und wechseln per STARTTLS.
    // SMTP_SECURE überschreibt das: 1, true, ja, yes oder on heißt verschlüsselt von Anfang an, 0, false, nein, no oder off das Gegenteil.
    secure: istJa(process.env.SMTP_SECURE) ?? port === 465,
    benutzer: process.env.SMTP_USER?.trim() || null,
    passwort: process.env.SMTP_PASS || null,
    absender,
  };
}

/** Wer über neue Anmeldungen informiert wird, durch Komma getrennt. */
export function teamAdressen(): string[] {
  return (process.env.TEAM_BENACHRICHTIGUNG ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
}

/** Liest einen Schalter aus der Umgebung. Null, wenn nichts oder etwas Unverständliches drinsteht. */
function istJa(wert: string | undefined): boolean | null {
  const w = wert?.trim().toLowerCase();
  if (!w) return null;
  if (["1", "true", "ja", "yes", "on"].includes(w)) return true;
  if (["0", "false", "nein", "no", "off"].includes(w)) return false;
  return null;
}
