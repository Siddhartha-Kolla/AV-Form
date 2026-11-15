import "server-only";
import "./anbieter-register.ts";
import { holeAnbieter } from "./anbieter.ts";
import {
  istGedrosselt,
  loescheAlteVersuche,
  registriereFehlversuch,
  vergesseVersuche,
  type Versuchsschluessel,
} from "./drosselung.ts";
import { findeKontoNachIdentitaet, markiereLogin, normalisiereBenutzername, type Konto } from "./konten.ts";
import { protokolliere } from "./protokoll.ts";
import { erstelleSitzung, loescheAbgelaufeneSitzungen } from "./sitzungen.ts";
import type { Kontext } from "./fehler.ts";

/*
  Der zentrale Anmeldeablauf. Er ist für alle Anbieter derselbe:
  Drosselung prüfen, Anbieter fragen, Konto zur Identität suchen, Sperre prüfen,
  Sitzung anlegen, protokollieren.
*/

export type AnmeldeErgebnis =
  | { ok: true; token: string; laeuftAbAm: Date; konto: Konto }
  | { ok: false; grund: "ungueltig" | "gedrosselt" | "gesperrt" };

/** Anmeldung über einen Formular-Anbieter (Passwort). */
export async function anmelden(
  anbieterId: string,
  eingabe: Record<string, string>,
  kontext: Kontext,
): Promise<AnmeldeErgebnis> {
  const anbieter = holeAnbieter(anbieterId);
  if (!anbieter || anbieter.art !== "formular" || !anbieter.pruefen) return { ok: false, grund: "ungueltig" };

  const name = normalisiereBenutzername(eingabe.benutzername ?? "").slice(0, 64);
  const schluessel: Versuchsschluessel[] = [];
  const benutzerSchluessel: Versuchsschluessel | null = name ? { art: "benutzer", wert: `${anbieterId}:${name}` } : null;
  if (benutzerSchluessel) schluessel.push(benutzerSchluessel);
  if (kontext.ip) schluessel.push({ art: "ip", wert: kontext.ip });

  if (istGedrosselt(schluessel)) {
    protokolliere(
      { ereignis: "login.gedrosselt", ergebnis: "fehler", details: { anbieter: anbieterId, benutzername: name } },
      kontext,
    );
    return { ok: false, grund: "gedrosselt" };
  }

  const ergebnis = await anbieter.pruefen(eingabe);
  if (!ergebnis) {
    registriereFehlversuch(schluessel);
    protokolliere(
      { ereignis: "login.fehlgeschlagen", ergebnis: "fehler", details: { anbieter: anbieterId, benutzername: name } },
      kontext,
    );
    return { ok: false, grund: "ungueltig" };
  }

  const antwort = anmeldenMitIdentitaet(anbieter.id, ergebnis.subjekt, kontext);
  if (antwort.ok && benutzerSchluessel) vergesseVersuche(benutzerSchluessel);
  if (!antwort.ok && antwort.grund === "ungueltig") registriereFehlversuch(schluessel);
  return antwort;
}

/**
 * Zweiter Teil des Ablaufs: Der Anbieter hat eine Identität bestätigt, jetzt geht es um das Konto.
 * Anbieter mit Weiterleitung rufen dies nach ihrer Rückkehr direkt auf.
 */
export function anmeldenMitIdentitaet(anbieterId: string, subjekt: string, kontext: Kontext): AnmeldeErgebnis {
  const konto = findeKontoNachIdentitaet(anbieterId, subjekt);
  if (!konto) {
    protokolliere({ ereignis: "login.kein_konto", ergebnis: "fehler", details: { anbieter: anbieterId } }, kontext);
    return { ok: false, grund: "ungueltig" };
  }
  const akteur = { id: konto.id, name: konto.anzeigename };
  if (konto.status !== "aktiv") {
    protokolliere({ ereignis: "login.gesperrt", ergebnis: "fehler", akteur, details: { anbieter: anbieterId } }, kontext);
    return { ok: false, grund: "gesperrt" };
  }

  const sitzung = erstelleSitzung(konto.id, anbieterId, kontext);
  markiereLogin(konto.id);
  protokolliere({ ereignis: "login.erfolg", akteur, details: { anbieter: anbieterId } }, kontext);
  loescheAbgelaufeneSitzungen();
  loescheAlteVersuche();
  return { ok: true, token: sitzung.token, laeuftAbAm: sitzung.laeuftAbAm, konto };
}
