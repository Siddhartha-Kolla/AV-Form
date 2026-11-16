// Prüft die E-Mail-Einstellungen: Verbindung und Anmeldung am SMTP-Server. Es wird keine Mail verschickt.
// Aufruf: npm run smtp:pruefen
import nodemailer from "nodemailer";
import { smtpEinstellungen } from "../lib/server/config.ts";

const s = smtpEinstellungen();
if (!s) {
  console.error("Keine SMTP-Einstellungen gefunden. SMTP_HOST und MAIL_FROM müssen gesetzt sein (siehe .env.example).");
  process.exit(1);
}
console.log("Einstellungen:", {
  host: s.host,
  port: s.port,
  verschluesseltVonAnfang: s.secure,
  benutzerGesetzt: !!s.benutzer,
  passwortGesetzt: !!s.passwort,
});

const transport = nodemailer.createTransport({
  host: s.host,
  port: s.port,
  secure: s.secure,
  requireTLS: !s.secure,
  auth: s.benutzer && s.passwort ? { user: s.benutzer, pass: s.passwort } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

const start = Date.now();
try {
  await transport.verify();
  console.log(`In Ordnung (${Date.now() - start} ms): Verbindung und Anmeldung funktionieren.`);
} catch (fehler) {
  const f = fehler as { code?: string; command?: string; responseCode?: number; message?: string };
  console.error(`Fehlgeschlagen nach ${Date.now() - start} ms:`, {
    code: f.code,
    befehl: f.command,
    antwortcode: f.responseCode,
    meldung: f.message,
  });
  process.exitCode = 1;
}
