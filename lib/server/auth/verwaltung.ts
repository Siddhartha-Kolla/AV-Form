import "server-only";
import { darf, istRolle, VERGEBBARE_ROLLEN, type Berechtigung, type RolleId } from "../../berechtigungen.ts";
import { FachFehler, type Kontext } from "./fehler.ts";
import { passwortAnbieter } from "./anbieter-passwort.ts";
import {
  aendereDaten,
  aendereRolle,
  erstelleKonto,
  findeKonto,
  findeKontoNachBenutzername,
  loescheKonto,
  setzePasswort,
  setzeStatus,
  superuserVorhanden,
  type Konto,
} from "./konten.ts";
import { istGedrosselt, registriereFehlversuch, type Versuchsschluessel } from "./drosselung.ts";
import { neuesStartpasswort, passwortPruefenOderFehler } from "./passwort.ts";
import { protokolliere } from "./protokoll.ts";
import { beendeAlleSitzungen, beendeSitzung } from "./sitzungen.ts";

/*
  Alles, was Konten verändert. Jede Funktion prüft die Berechtigung des Akteurs selbst,
  schreibt ins Protokoll und beendet bei Bedarf Sitzungen. Die Oberfläche ruft nur diese
  Funktionen auf, nie direkt konten.ts.
*/

function verlange(akteur: Konto, berechtigung: Berechtigung): void {
  if (akteur.status !== "aktiv" || !darf(akteur.rolle, berechtigung)) {
    throw new FachFehler("Dafür fehlt die Berechtigung.");
  }
}

function ziel(konto: Konto) {
  return { typ: "konto", id: konto.id, name: konto.anzeigename };
}

function holeMitglied(id: string): Konto {
  const konto = findeKonto(id);
  if (!konto) throw new FachFehler("Dieses Mitglied gibt es nicht mehr.");
  return konto;
}

export async function legeMitgliedAn(
  akteur: Konto,
  eingabe: { benutzername: string; anzeigename: string; email?: string; rolle: string; passwort?: string },
  kontext: Kontext,
): Promise<{ konto: Konto; startpasswort: string | null }> {
  verlange(akteur, "team.verwalten");
  if (!istRolle(eingabe.rolle) || !VERGEBBARE_ROLLEN.includes(eingabe.rolle)) {
    throw new FachFehler("Diese Rolle lässt sich nicht vergeben.");
  }
  const erzeugt = !eingabe.passwort?.trim();
  const passwort = erzeugt ? neuesStartpasswort() : eingabe.passwort!;
  const konto = await erstelleKonto({
    benutzername: eingabe.benutzername,
    anzeigename: eingabe.anzeigename,
    email: eingabe.email,
    rolle: eingabe.rolle as RolleId,
    passwort,
    mussPasswortAendern: true,
  });
  protokolliere(
    { ereignis: "konto.angelegt", akteur: { id: akteur.id, name: akteur.anzeigename }, ziel: ziel(konto), details: { rolle: konto.rolle } },
    kontext,
  );
  return { konto, startpasswort: erzeugt ? passwort : null };
}

export function aendereMitglied(
  akteur: Konto,
  id: string,
  eingabe: { anzeigename: string; email?: string; rolle: string },
  kontext: Kontext,
): Konto {
  verlange(akteur, "team.verwalten");
  const vorher = holeMitglied(id);
  const felder: string[] = [];
  let konto = vorher;
  if (eingabe.anzeigename.trim() !== vorher.anzeigename || (eingabe.email ?? "").trim() !== vorher.email) {
    konto = aendereDaten(id, { anzeigename: eingabe.anzeigename, email: eingabe.email });
    if (konto.anzeigename !== vorher.anzeigename) felder.push("anzeigename");
    if (konto.email !== vorher.email) felder.push("email");
  }
  if (eingabe.rolle !== vorher.rolle) {
    konto = aendereRolle(id, eingabe.rolle);
    felder.push("rolle");
  }
  if (felder.length > 0) {
    protokolliere(
      {
        ereignis: "konto.geaendert",
        akteur: { id: akteur.id, name: akteur.anzeigename },
        ziel: ziel(konto),
        details: { felder, rolle: konto.rolle },
      },
      kontext,
    );
  }
  return konto;
}

export function setzeMitgliedStatus(akteur: Konto, id: string, status: "aktiv" | "gesperrt", kontext: Kontext): Konto {
  verlange(akteur, "team.verwalten");
  const konto = setzeStatus(id, status);
  if (status === "gesperrt") beendeAlleSitzungen(id);
  protokolliere(
    {
      ereignis: status === "gesperrt" ? "konto.gesperrt" : "konto.entsperrt",
      akteur: { id: akteur.id, name: akteur.anzeigename },
      ziel: ziel(konto),
    },
    kontext,
  );
  return konto;
}

/** Setzt ein neues Startpasswort. Die Person muss es beim nächsten Login ändern, alte Sitzungen enden. */
export async function setzeMitgliedPasswortZurueck(
  akteur: Konto,
  id: string,
  eigenesPasswort: string | undefined,
  kontext: Kontext,
): Promise<{ startpasswort: string | null }> {
  verlange(akteur, "team.verwalten");
  const konto = holeMitglied(id);
  if (konto.rolle === "superuser") {
    throw new FachFehler("Das Passwort des Superusers lässt sich nur über die Kommandozeile auf dem Server zurücksetzen.");
  }
  const erzeugt = !eigenesPasswort?.trim();
  const passwort = erzeugt ? neuesStartpasswort() : eigenesPasswort!;
  await setzePasswort(id, passwort, true);
  const beendet = beendeAlleSitzungen(id);
  protokolliere(
    {
      ereignis: "passwort.zurueckgesetzt",
      akteur: { id: akteur.id, name: akteur.anzeigename },
      ziel: ziel(konto),
      details: { sitzungenBeendet: beendet },
    },
    kontext,
  );
  return { startpasswort: erzeugt ? passwort : null };
}

export function beendeMitgliedSitzungen(akteur: Konto, id: string, kontext: Kontext): number {
  verlange(akteur, "team.verwalten");
  const konto = holeMitglied(id);
  const anzahl = beendeAlleSitzungen(id);
  protokolliere(
    { ereignis: "sitzungen.beendet", akteur: { id: akteur.id, name: akteur.anzeigename }, ziel: ziel(konto), details: { anzahl } },
    kontext,
  );
  return anzahl;
}

export function loescheMitglied(akteur: Konto, id: string, kontext: Kontext): void {
  verlange(akteur, "team.verwalten");
  if (akteur.id === id) throw new FachFehler("Das eigene Konto lässt sich nicht löschen.");
  const konto = loescheKonto(id);
  protokolliere(
    { ereignis: "konto.geloescht", akteur: { id: akteur.id, name: akteur.anzeigename }, ziel: ziel(konto), details: { benutzername: konto.benutzername } },
    kontext,
  );
}

/* Eigenes Konto ----------------------------------------------------------- */

export async function aendereEigenesPasswort(
  konto: Konto,
  aktuelleSitzungId: string,
  eingabe: { aktuell: string; neu: string },
  kontext: Kontext,
): Promise<void> {
  const schluessel: Versuchsschluessel = { art: "benutzer", wert: `passwort:${konto.benutzername}` };
  if (istGedrosselt([schluessel])) {
    throw new FachFehler("Zu viele Versuche. Bitte in 15 Minuten noch einmal probieren.");
  }
  const stimmt = await passwortAnbieter.pruefen!({ benutzername: konto.benutzername, passwort: eingabe.aktuell });
  if (!stimmt) {
    registriereFehlversuch([schluessel]);
    throw new FachFehler("Das aktuelle Passwort stimmt nicht.");
  }
  if (eingabe.neu === eingabe.aktuell) throw new FachFehler("Das neue Passwort muss sich vom alten unterscheiden.");
  passwortPruefenOderFehler(eingabe.neu, konto.benutzername);
  await setzePasswort(konto.id, eingabe.neu, false);
  const beendet = beendeAlleSitzungen(konto.id, aktuelleSitzungId);
  protokolliere(
    {
      ereignis: "passwort.geaendert",
      akteur: { id: konto.id, name: konto.anzeigename },
      ziel: ziel(konto),
      details: { andereSitzungenBeendet: beendet },
    },
    kontext,
  );
}

export function beendeEigeneAndereSitzungen(konto: Konto, aktuelleSitzungId: string, kontext: Kontext): number {
  const anzahl = beendeAlleSitzungen(konto.id, aktuelleSitzungId);
  protokolliere(
    { ereignis: "sitzungen.beendet", akteur: { id: konto.id, name: konto.anzeigename }, ziel: ziel(konto), details: { anzahl } },
    kontext,
  );
  return anzahl;
}

export function abmelden(token: string, konto: Konto, kontext: Kontext): void {
  beendeSitzung(token);
  protokolliere({ ereignis: "logout", akteur: { id: konto.id, name: konto.anzeigename } }, kontext);
}

/* Kommandozeile auf dem Server ------------------------------------------- */

/** Legt den einen Superuser an. Nur über die Kommandozeile, nie über die Oberfläche. */
export async function legeSuperuserAn(
  eingabe: { benutzername: string; anzeigename: string; email?: string },
  kontext: Kontext,
): Promise<{ konto: Konto; startpasswort: string }> {
  if (superuserVorhanden()) throw new FachFehler("Es gibt schon einen Superuser.");
  const startpasswort = neuesStartpasswort();
  const konto = await erstelleKonto({ ...eingabe, rolle: "superuser", passwort: startpasswort, mussPasswortAendern: true });
  protokolliere({ ereignis: "cli.superuser_angelegt", ziel: ziel(konto) }, kontext);
  return { konto, startpasswort };
}

/** Notfall: setzt das Passwort irgendeines Kontos zurück, auch das des Superusers. */
export async function setzePasswortPerKommandozeile(
  benutzername: string,
  kontext: Kontext,
): Promise<{ konto: Konto; startpasswort: string }> {
  const konto = findeKontoNachBenutzername(benutzername);
  if (!konto) throw new FachFehler("Dieses Konto gibt es nicht.");
  const startpasswort = neuesStartpasswort();
  await setzePasswort(konto.id, startpasswort, true);
  beendeAlleSitzungen(konto.id);
  protokolliere({ ereignis: "cli.passwort_zurueckgesetzt", ziel: ziel(konto) }, kontext);
  return { konto, startpasswort };
}
