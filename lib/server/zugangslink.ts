import "server-only";
import { heuteBerlin } from "../format.ts";
import { mailZugangslinks } from "../mail-vorlagen.ts";
import { planeZugangslinks } from "./anmeldungen.ts";
import { istGedrosselt, registriereVersuch, type Versuchsschluessel } from "./auth/drosselung.ts";
import type { Kontext } from "./auth/fehler.ts";
import { protokolliere } from "./auth/protokoll.ts";
import { appUrl } from "./config.ts";
import { sendeMailMitGrund } from "./mail.ts";

/*
  "Link verloren": Eine Lehrkraft kommt nur über ihren privaten Link an die Anmeldung, und von dem Token steht in der
  Datenbank nur ein Hash. Wer den Link verliert, gibt hier seine E-Mail-Adresse ein und bekommt neue Links per Mail.

  - Die Antwort ist immer dieselbe, ob es die Adresse gibt oder nicht. Die Links stehen nur in der Mail.
  - Die Mail geht im Hintergrund raus, damit die Antwortzeit nichts verrät.
  - Die alten Links werden erst ungültig, wenn die Mail verschickt ist. Fällt der Mailversand aus, bleibt alles wie vorher.
  - Anfragen sind je IP-Adresse, je E-Mail-Adresse und insgesamt begrenzt.
  - Wer die Adresse einer Lehrkraft kennt, kann deren Links alle 15 Minuten ersetzen lassen. Die Lehrkraft bekommt dann
    jedes Mal neue per Mail, und jede Anfrage steht im Protokoll.
*/

export type LinkAnfrage =
  | { ok: true; /** Fertig, sobald die Mail raus ist. Die Antwort an den Besucher wartet nicht darauf. */ fertig: Promise<void> }
  | { ok: false; meldung: string; gedrosselt?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function fordereZugangslinksAn(
  eingabe: string,
  kontext: Kontext,
  optionen: { jetzt?: Date; sende?: typeof sendeMailMitGrund } = {},
): Promise<LinkAnfrage> {
  const jetzt = optionen.jetzt ?? new Date();
  const sende = optionen.sende ?? sendeMailMitGrund;

  const email = eingabe.trim().toLowerCase();
  if (email.length > 200 || !EMAIL.test(email)) return { ok: false, meldung: "Bitte geben Sie eine gültige E-Mail-Adresse ein." };

  const grenzen: Versuchsschluessel[] = [
    { art: "link_alle", wert: "alle" },
    { art: "link_email", wert: email },
  ];
  if (kontext.ip) grenzen.push({ art: "link_ip", wert: kontext.ip });
  if (istGedrosselt(grenzen, jetzt)) {
    return { ok: false, gedrosselt: true, meldung: "Es gab gerade zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten noch einmal." };
  }
  registriereVersuch(grenzen, jetzt);

  const plan = planeZugangslinks(email, heuteBerlin(jetzt));
  // Die Adresse selbst steht nicht im Protokoll, nur wie viele Anmeldungen dazu gehören.
  protokolliere({ ereignis: "link.angefordert", details: { anzahl: plan.links.length } }, kontext);
  if (plan.links.length === 0) return { ok: true, fertig: Promise.resolve() };

  const fertig = (async () => {
    try {
      const basis = appUrl();
      const versand = basis
        ? await sende({
            an: email,
            ...mailZugangslinks({ eintraege: plan.links.map((l) => ({ titel: l.titel, datum: l.datum, link: `${basis}/anmeldung/${l.token}` })) }),
          })
        : { ergebnis: "nicht_konfiguriert" as const, grund: "APP_URL ist nicht gesetzt." };
      if (versand.ergebnis === "gesendet") {
        plan.uebernehmen();
        return;
      }
      protokolliere(
        {
          ereignis: "mail.fehlgeschlagen",
          ergebnis: "fehler",
          details: { anlass: "Link verloren", versand: versand.ergebnis, grund: versand.grund ?? "unbekannt" },
        },
        kontext,
      );
    } catch (fehler) {
      console.error("Neue Links ließen sich nicht verschicken:", fehler instanceof Error ? fehler.message : fehler);
    }
  })();
  return { ok: true, fertig };
}
