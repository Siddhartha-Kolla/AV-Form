import "server-only";
import { heuteBerlin } from "../format.ts";
import { parseDatum } from "../registration.ts";
import {
  findeNachToken,
  listeEntscheidungen,
  type Anmeldung,
  type EntscheidungsEintrag,
} from "./anmeldungen.ts";
import type { Kontext } from "./auth/fehler.ts";
import { protokolliere } from "./auth/protokoll.ts";
import { wendeBearbeitungAn, type BearbeitenEingabe, type BearbeitenErgebnis } from "./bearbeiten.ts";
import { listeDateien, type DateiInfo } from "./dateien.ts";

/*
  Zugriff der Lehrkraft über den privaten Link. Der Link ist die einzige Tür: Wer ihn kennt, sieht und ändert
  genau diese eine Anmeldung. Es gibt kein Konto und keine Sitzung.
*/

export type LehrkraftAnsicht = {
  anmeldung: Anmeldung;
  dateien: DateiInfo[];
  /** Die Nachricht des Teams zur aktuellen Entscheidung, falls es eine gab. */
  entscheidung: EntscheidungsEintrag | null;
  /** Ändern geht nur bei Anmeldungen, die noch gelten und nicht in der Vergangenheit liegen. */
  kannAendern: boolean;
  /** Warum nicht, wenn nicht. */
  grund: string | null;
};

function aenderungsGrund(a: Anmeldung): string | null {
  if (a.status === "abgelehnt") return "Diese Anmeldung wurde abgelehnt und lässt sich nicht mehr ändern.";
  if (a.values.datum < heuteBerlin()) return "Die Veranstaltung liegt in der Vergangenheit. Änderungen sind nicht mehr möglich.";
  return null;
}

export function ladeFuerLehrkraft(token: string): LehrkraftAnsicht | null {
  const anmeldung = findeNachToken(token);
  if (!anmeldung) return null;
  const entscheidung =
    anmeldung.status === "neu" ? null : (listeEntscheidungen(anmeldung.id).find((e) => e.status === anmeldung.status) ?? null);
  const grund = aenderungsGrund(anmeldung);
  return { anmeldung, dateien: listeDateien(anmeldung.id), entscheidung, kannAendern: grund === null, grund };
}

export function bearbeiteFuerLehrkraft(token: string, eingabe: BearbeitenEingabe, kontext: Kontext): BearbeitenErgebnis {
  const anmeldung = findeNachToken(token);
  if (!anmeldung) return { ok: false, meldung: "Dieser Link ist nicht mehr gültig." };
  const grund = aenderungsGrund(anmeldung);
  if (grund) return { ok: false, meldung: grund };

  // Die Lehrkraft schreibt keinen Vermerk. Geprüft wird gegen das heutige Datum, ein Termin in der Vergangenheit ist ein Fehler.
  const ergebnis = wendeBearbeitungAn(anmeldung.id, null, { ...eingabe, notiz: "" }, parseDatum(heuteBerlin()));
  if (ergebnis.ok && ergebnis.geaendert.length > 0) {
    protokolliere(
      {
        ereignis: "anmeldung.von_lehrkraft_geaendert",
        ziel: { typ: "anmeldung", id: anmeldung.id, name: ergebnis.titel },
        details: { felder: ergebnis.geaendert, dateienHinzu: ergebnis.dateienHinzu, dateienEntfernt: ergebnis.dateienEntfernt },
      },
      kontext,
    );
  }
  return ergebnis;
}
