import "server-only";
import { heuteBerlin } from "../format.ts";
import { parseDatum, parseFormValues, validate, type Fehler, type FormValues } from "../registration.ts";
import { erstelleAnmeldung, loescheAnmeldung } from "./anmeldungen.ts";
import { istGedrosselt, registriereVersuch, type Versuchsschluessel } from "./auth/drosselung.ts";
import type { Kontext } from "./auth/fehler.ts";
import { protokolliere } from "./auth/protokoll.ts";
import { appUrl, teamAdressen } from "./config.ts";
import { pruefeUpload, speichereDatei } from "./dateien.ts";
import { mailEingang, mailTeamNeu, type Termin } from "../mail-vorlagen.ts";
import { sendeMail, sendeMailMitGrund, type MailErgebnis } from "./mail.ts";

/*
  Die öffentliche Anmeldung einer Lehrkraft. Ohne Konto, deshalb besonders vorsichtig:
  Alles wird auf dem Server noch einmal geprüft, Einreichungen sind gedrosselt, und was nicht
  vollständig gespeichert werden kann, wird gar nicht erst angelegt.
*/

export type EinreichenEingabe = {
  /** Die Angaben aus dem Formular. Kommen vom Browser und werden geprüft und bereinigt. */
  values: unknown;
  dateien: { name: string; inhalt: Buffer }[];
};

export type EinreichenErgebnis =
  | { ok: true; mail: MailErgebnis }
  | { ok: false; meldung?: string; fehler?: Fehler; dateiFehler?: string[] };

function schluessel(kontext: Kontext): Versuchsschluessel[] {
  const liste: Versuchsschluessel[] = [{ art: "einreichung_alle", wert: "alle" }];
  if (kontext.ip) liste.push({ art: "einreichung_ip", wert: kontext.ip });
  return liste;
}

function termin(v: FormValues): Termin {
  return { titel: v.titel, datum: v.datum, beginn: v.beginn, ende: v.ende, ort: v.ort };
}

/**
 * Legt eine Anmeldung an, speichert die Dateien und verschickt die Mails.
 * Die Anmeldung gilt auch dann als eingegangen, wenn eine Mail nicht rausgeht. Das Ergebnis sagt es.
 */
export async function reicheAnmeldungEin(eingabe: EinreichenEingabe, kontext: Kontext): Promise<EinreichenErgebnis> {
  const grenzen = schluessel(kontext);
  if (istGedrosselt(grenzen)) {
    return { ok: false, meldung: "Es sind gerade zu viele Anmeldungen eingegangen. Bitte versuchen Sie es in einigen Minuten noch einmal." };
  }

  const geparst = parseFormValues(eingabe.values);
  if (!geparst.ok) return { ok: false, meldung: geparst.meldung };
  const fehler = validate(geparst.values, parseDatum(heuteBerlin()));
  if (Object.keys(fehler).length > 0) return { ok: false, fehler };
  const dateiFehler = pruefeUpload(eingabe.dateien);
  if (dateiFehler.length > 0) return { ok: false, dateiFehler };

  const v = geparst.values;
  const { id, token } = erstelleAnmeldung(v);
  try {
    for (const d of eingabe.dateien) speichereDatei(id, d.name, d.inhalt, { anzahlSchonGeprueft: true });
  } catch (f) {
    // Lieber nichts als eine Anmeldung, bei der Unterlagen fehlen, ohne dass die Lehrkraft es weiß.
    loescheAnmeldung(id);
    console.error("Dateien einer Anmeldung ließen sich nicht speichern:", f instanceof Error ? f.message : f);
    return { ok: false, meldung: "Die Dateien ließen sich nicht speichern. Bitte versuchen Sie es noch einmal." };
  }

  registriereVersuch(grenzen);
  protokolliere(
    { ereignis: "anmeldung.eingegangen", ziel: { typ: "anmeldung", id, name: v.titel }, details: { dateien: eingabe.dateien.length } },
    kontext,
  );

  // Mails erst nach dem Speichern. Ein Fehler dabei ändert nichts mehr an der Anmeldung.
  const basis = appUrl();
  const versand = basis
    ? await sendeMailMitGrund({ an: v.email, ...mailEingang({ lehrkraft: v.lehrkraft, termin: termin(v), link: `${basis}/anmeldung/${token}` }) })
    : { ergebnis: "nicht_konfiguriert" as MailErgebnis, grund: "APP_URL ist nicht gesetzt." };
  const mail = versand.ergebnis;
  if (mail !== "gesendet") {
    // Damit die Ursache auch ohne Blick ins Terminal im Protokoll steht.
    protokolliere(
      {
        ereignis: "mail.fehlgeschlagen",
        ergebnis: "fehler",
        ziel: { typ: "anmeldung", id, name: v.titel },
        details: { versand: mail, grund: versand.grund ?? "unbekannt" },
      },
      kontext,
    );
  }
  if (basis) {
    // Das Team zu benachrichtigen darf die Antwort an die Lehrkraft nicht aufhalten.
    void Promise.all(teamAdressen().map((an) => sendeMail({ an, ...mailTeamNeu({ lehrkraft: v.lehrkraft, termin: termin(v), link: `${basis}/team/anmeldungen/${id}` }) })));
  }
  return { ok: true, mail };
}
