import "server-only";
import type { Entscheidung } from "../entscheidung.ts";
import { mailEntscheidung, mailTeamGeaendert, type Termin } from "../mail-vorlagen.ts";
import { findeNachId } from "./anmeldungen.ts";
import type { Kontext } from "./auth/fehler.ts";
import { protokolliere } from "./auth/protokoll.ts";
import { appUrl, teamAdressen } from "./config.ts";
import { sendeMail, sendeMailMitGrund, type MailErgebnis } from "./mail.ts";

/*
  Benachrichtigungen bei Änderungen am Stand einer Anmeldung.

  - Das Team entscheidet: Die Lehrkraft bekommt eine Mail mit Ergebnis und Nachricht.
  - Die Lehrkraft ändert etwas, nachdem das Team schon entschieden hat: Das Team bekommt eine Mail.

  Der private Link der Lehrkraft steht nur in der ersten Mail. Gespeichert ist von ihm nur ein Hash,
  deshalb lässt er sich später nicht noch einmal nennen.
  Ein Fehler beim Versand ändert nichts an der Entscheidung. Er steht im Protokoll.
*/

function terminVon(v: { titel: string; datum: string; beginn: string; ende: string; ort: string }): Termin {
  return { titel: v.titel, datum: v.datum, beginn: v.beginn, ende: v.ende, ort: v.ort };
}

/** Schickt der Lehrkraft das Ergebnis der Entscheidung. Das Ergebnis sagt, ob die Mail rausging. */
export async function benachrichtigeLehrkraft(
  id: string,
  entscheidung: { status: Entscheidung; nachricht: string; akteur: { id: string; name: string } },
  kontext: Kontext,
): Promise<MailErgebnis> {
  const anmeldung = findeNachId(id);
  if (!anmeldung) return "fehlgeschlagen";
  const v = anmeldung.values;

  const versand = await sendeMailMitGrund({
    an: v.email,
    ...mailEntscheidung({
      lehrkraft: v.lehrkraft,
      termin: terminVon(v),
      status: entscheidung.status,
      nachricht: entscheidung.nachricht.trim() || null,
      absender: entscheidung.akteur.name,
    }),
  });
  if (versand.ergebnis !== "gesendet") {
    protokolliere(
      {
        ereignis: "mail.fehlgeschlagen",
        ergebnis: "fehler",
        akteur: entscheidung.akteur,
        ziel: { typ: "anmeldung", id, name: v.titel },
        details: { mail: "Entscheidung", versand: versand.ergebnis, grund: versand.grund ?? "unbekannt" },
      },
      kontext,
    );
  }
  return versand.ergebnis;
}

/** Sagt dem Team, dass die Lehrkraft etwas geändert hat. Wartet nicht auf den Versand. */
export function benachrichtigeTeamGeaendert(id: string): void {
  const basis = appUrl();
  const anmeldung = findeNachId(id);
  if (!basis || !anmeldung) return;
  const v = anmeldung.values;
  const inhalt = mailTeamGeaendert({ lehrkraft: v.lehrkraft, termin: terminVon(v), link: `${basis}/team/anmeldungen/${id}` });
  void Promise.all(teamAdressen().map((an) => sendeMail({ an, ...inhalt })));
}
