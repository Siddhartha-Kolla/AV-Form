import "server-only";
import { darf, type Berechtigung } from "../berechtigungen.ts";
import { FachFehler, type Kontext } from "./auth/fehler.ts";
import type { Konto } from "./auth/konten.ts";
import { kuerzlichProtokolliert, protokolliere } from "./auth/protokoll.ts";
import {
  findeNachId,
  listeAnmeldungen,
  loescheAnmeldung,
  type Anmeldung,
  type AnmeldungMitZusatz,
} from "./anmeldungen.ts";
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
): { anmeldung: Anmeldung; dateien: DateiInfo[]; aenderungen: { zeit: string; felder: string[] }[] } | null {
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
  const alle = listeAnmeldungen().anmeldungen.find((a) => a.id === id);
  return { anmeldung, dateien: listeDateien(id), aenderungen: alle?.aenderungen ?? [] };
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
