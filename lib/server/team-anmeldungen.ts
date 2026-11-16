import "server-only";
import { darf, type Berechtigung } from "../berechtigungen.ts";
import { FachFehler, type Kontext } from "./auth/fehler.ts";
import type { Konto } from "./auth/konten.ts";
import { kuerzlichProtokolliert, protokolliere } from "./auth/protokoll.ts";
import { pruefeEntscheidung, type Entscheidung, type StatusId } from "../entscheidung.ts";
import {
  entscheideAnmeldung,
  findeNachId,
  listeAenderungen,
  listeEntscheidungen,
  listeAnmeldungen,
  loescheAnmeldung,
  type Aenderung,
  type Anmeldung,
  type AnmeldungMitZusatz,
  type EntscheidungsEintrag,
} from "./anmeldungen.ts";
import { wendeBearbeitungAn, type BearbeitenEingabe, type BearbeitenErgebnis } from "./bearbeiten.ts";
import { leseDatei, listeDateien, type DateiInfo } from "./dateien.ts";

/*
  Zugriff des Technikteams auf Anmeldungen. Jede Funktion prüft die Berechtigung selbst
  und schreibt ins Protokoll, wer was gesehen, geladen oder gelöscht hat.
*/

function verlange(akteur: Konto, berechtigung: Berechtigung): void {
  if (akteur.status !== "aktiv" || !darf(akteur.rolle, berechtigung)) {
    throw new FachFehler("Dafür fehlt die Berechtigung.");
  }
}

export function alleFuerTeam(akteur: Konto): { anmeldungen: AnmeldungMitZusatz[]; unlesbar: string[] } {
  verlange(akteur, "anmeldungen.lesen");
  return listeAnmeldungen();
}

/** Öffnet eine Anmeldung. Das Ansehen wird protokolliert, aber höchstens einmal pro 30 Minuten je Person. */
export function oeffneFuerTeam(
  akteur: Konto,
  id: string,
  kontext: Kontext,
): { anmeldung: Anmeldung; dateien: DateiInfo[]; aenderungen: Aenderung[]; entscheidungen: EntscheidungsEintrag[] } | null {
  verlange(akteur, "anmeldungen.lesen");
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const anmeldung = findeNachId(id);
  if (!anmeldung) return null;
  if (!kuerzlichProtokolliert(akteur.id, "anmeldung.angesehen", id, 30)) {
    protokolliere(
      {
        ereignis: "anmeldung.angesehen",
        akteur: { id: akteur.id, name: akteur.anzeigename },
        ziel: { typ: "anmeldung", id, name: anmeldung.values.titel },
      },
      kontext,
    );
  }
  return {
    anmeldung,
    dateien: listeDateien(id),
    aenderungen: listeAenderungen(id),
    entscheidungen: listeEntscheidungen(id),
  };
}

/**
 * Liefert eine Datei. Ein Download wird immer protokolliert. Die Vorschau höchstens einmal in
 * 30 Minuten je Person und Datei, weil beim Blättern durch Unterlagen sonst jede Datei mehrfach zählt.
 */
export function ladeDateiFuerTeam(
  akteur: Konto,
  anmeldungId: string,
  dateiId: string,
  kontext: Kontext,
  zweck: "download" | "vorschau" = "download",
) {
  verlange(akteur, "anmeldungen.lesen");
  const datei = leseDatei(anmeldungId, dateiId);
  if (!datei) return null;
  const ereignis = zweck === "vorschau" ? "datei.angesehen" : "datei.heruntergeladen";
  if (zweck === "download" || !kuerzlichProtokolliert(akteur.id, ereignis, dateiId, 30)) {
    const anmeldung = findeNachId(anmeldungId);
    protokolliere(
      {
        ereignis,
        akteur: { id: akteur.id, name: akteur.anzeigename },
        ziel: { typ: "datei", id: dateiId, name: datei.info.name },
        details: { anmeldung: anmeldung?.values.titel ?? anmeldungId },
      },
      kontext,
    );
  }
  return datei;
}

export function loescheAnmeldungFuerTeam(akteur: Konto, id: string, kontext: Kontext): void {
  verlange(akteur, "anmeldungen.loeschen");
  const anmeldung = findeNachId(id);
  if (!anmeldung) throw new FachFehler("Diese Anmeldung gibt es nicht mehr.");
  loescheAnmeldung(id);
  protokolliere(
    {
      ereignis: "anmeldung.geloescht",
      akteur: { id: akteur.id, name: akteur.anzeigename },
      ziel: { typ: "anmeldung", id, name: anmeldung.values.titel },
      details: { datum: anmeldung.values.datum },
    },
    kontext,
  );
}


/* Entscheiden ----------------------------------------------------------------- */

export type EntscheidungsErgebnis = { ok: true } | { ok: false; meldung: string };

/** Nimmt eine Anmeldung an, stellt eine Rückfrage oder lehnt sie ab. Die Nachricht ist für die Lehrkraft gedacht. */
export function entscheideFuerTeam(
  akteur: Konto,
  id: string,
  eingabe: { status: unknown; nachricht: string; erwarteterStatus: StatusId },
  kontext: Kontext,
): EntscheidungsErgebnis {
  verlange(akteur, "anmeldungen.entscheiden");
  const nachricht = eingabe.nachricht.replace(/\r\n/g, "\n").trim();
  const problem = pruefeEntscheidung(eingabe.status, nachricht);
  if (problem) return { ok: false, meldung: problem };
  const status = eingabe.status as Entscheidung;

  const anmeldung = findeNachId(id);
  if (!anmeldung) return { ok: false, meldung: "Diese Anmeldung gibt es nicht mehr." };
  try {
    const ergebnis = entscheideAnmeldung(id, {
      status,
      nachricht,
      erwarteterStatus: eingabe.erwarteterStatus,
      akteur: { id: akteur.id, name: akteur.anzeigename },
    });
    if (!ergebnis) return { ok: false, meldung: "Diese Anmeldung gibt es nicht mehr." };
    protokolliere(
      {
        ereignis: "anmeldung.entschieden",
        akteur: { id: akteur.id, name: akteur.anzeigename },
        ziel: { typ: "anmeldung", id, name: anmeldung.values.titel },
        details: { status, vorher: ergebnis.vorher, mitNachricht: nachricht ? "ja" : "nein" },
      },
      kontext,
    );
    return { ok: true };
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { ok: false, meldung: fehler.message };
    throw fehler;
  }
}

/* Bearbeiten ------------------------------------------------------------------ */

/** Lädt eine Anmeldung zum Bearbeiten. Das Bearbeiten selbst wird beim Speichern protokolliert. */
export function ladeZumBearbeiten(akteur: Konto, id: string): { anmeldung: Anmeldung; dateien: DateiInfo[] } | null {
  verlange(akteur, "anmeldungen.bearbeiten");
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const anmeldung = findeNachId(id);
  return anmeldung ? { anmeldung, dateien: listeDateien(id) } : null;
}

export type { BearbeitenEingabe, BearbeitenErgebnis };

/**
 * Speichert Änderungen am Formular, entfernt Dateien und fügt neue hinzu, alles in einem Schritt.
 * Geprüft wird vorher vollständig. Nur wenn alles in Ordnung ist, wird etwas verändert.
 */
export function bearbeiteFuerTeam(
  akteur: Konto,
  id: string,
  eingabe: BearbeitenEingabe,
  kontext: Kontext,
): BearbeitenErgebnis {
  verlange(akteur, "anmeldungen.bearbeiten");
  // Vergangene Termine darf das Team bearbeiten, deshalb ohne Prüfung gegen das heutige Datum.
  const ergebnis = wendeBearbeitungAn(id, { id: akteur.id, name: akteur.anzeigename }, eingabe, null);
  if (ergebnis.ok && ergebnis.geaendert.length > 0) {
    protokolliere(
      {
        ereignis: "anmeldung.bearbeitet",
        akteur: { id: akteur.id, name: akteur.anzeigename },
        ziel: { typ: "anmeldung", id, name: ergebnis.titel },
        details: {
          felder: ergebnis.geaendert,
          dateienHinzu: ergebnis.dateienHinzu,
          dateienEntfernt: ergebnis.dateienEntfernt,
        },
      },
      kontext,
    );
  }
  return ergebnis;
}
