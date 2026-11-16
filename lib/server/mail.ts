import "server-only";
import nodemailer from "nodemailer";
import { smtpEinstellungen } from "./config.ts";

/*
  Versand von E-Mails über den SMTP-Server der Schule (SMTP_HOST, MAIL_FROM, siehe .env.example).

  Ohne SMTP-Einstellungen:
  - In der Entwicklung erscheint die Mail im Terminal. So lässt sich der ganze Ablauf ausprobieren.
    Im Betrieb geht das nur mit MAIL_IN_TERMINAL=1, zum Ausprobieren eines Produktions-Builds.
  - Sonst wird nichts verschickt. Das Ergebnis ist "nicht_konfiguriert", und der Aufrufer sagt das ehrlich weiter.

  Ein Fehler beim Versand wirft nie nach außen: Die Anmeldung ist dann trotzdem gespeichert.
*/

export type MailErgebnis = "gesendet" | "nicht_konfiguriert" | "fehlgeschlagen";

export type Mail = { an: string; betreff: string; text: string; html?: string };

const global = globalThis as unknown as { __technikMail?: { schluessel: string; transport: nodemailer.Transporter } };

function transport(): nodemailer.Transporter | null {
  const s = smtpEinstellungen();
  if (!s) return null;
  // Der Transport wird wiederverwendet, aber neu gebaut, sobald sich die Einstellungen ändern.
  // Sonst bliebe nach einer Änderung der .env der alte Stand aktiv, bis der Server neu startet.
  const schluessel = JSON.stringify(s);
  if (global.__technikMail?.schluessel === schluessel) return global.__technikMail.transport;
  const neu = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    // Ohne Verschlüsselung gehen Passwort und Inhalt im Klartext über die Leitung.
    requireTLS: !s.secure,
    auth: s.benutzer && s.passwort ? { user: s.benutzer, pass: s.passwort } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  global.__technikMail = { schluessel, transport: neu };
  return neu;
}

/** Entfernt Zeilenumbrüche aus Werten, die in Kopfzeilen landen. */
function einzeilig(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

export async function sendeMail(mail: Mail): Promise<MailErgebnis> {
  return (await sendeMailMitGrund(mail)).ergebnis;
}

/** Wie sendeMail, nennt aber bei einem Fehler die Antwort des Servers. Sie enthält weder Empfänger noch Inhalt. */
export async function sendeMailMitGrund(mail: Mail): Promise<{ ergebnis: MailErgebnis; grund: string | null }> {
  const s = smtpEinstellungen();
  if (!s) {
    if (process.env.NODE_ENV === "production" && process.env.MAIL_IN_TERMINAL !== "1") {
      return { ergebnis: "nicht_konfiguriert", grund: "SMTP_HOST oder MAIL_FROM ist nicht gesetzt." };
    }
    // Nur in der Entwicklung: die Mail steht im Terminal, auch mit Link.
    console.log(`\n--- E-Mail (Entwicklung, nicht verschickt) ---\nAn: ${mail.an}\nBetreff: ${mail.betreff}\n\n${mail.text}\n---\n`);
    return { ergebnis: "gesendet", grund: null };
  }
  try {
    await transport()!.sendMail({
      from: s.absender,
      to: einzeilig(mail.an),
      subject: einzeilig(mail.betreff),
      text: mail.text,
      html: mail.html,
    });
    return { ergebnis: "gesendet", grund: null };
  } catch (fehler) {
    // Weder Inhalt noch Empfänger ins Log: Beides ist personenbezogen.
    const grund = (fehler instanceof Error ? fehler.message : String(fehler)).slice(0, 300);
    console.error("E-Mail-Versand fehlgeschlagen:", grund);
    return { ergebnis: "fehlgeschlagen", grund };
  }
}
