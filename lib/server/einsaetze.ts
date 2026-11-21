import "server-only";
import { darf, type Berechtigung } from "../berechtigungen.ts";
import {
  besetzungGesperrt,
  pruefeAntwort,
  pruefeBenoetigt,
  zaehle,
  type Antwort,
  type BesetzungKurz,
  type MeineAntwort,
} from "../besetzung.ts";
import { heuteBerlin } from "../format.ts";
import { findeNachId } from "./anmeldungen.ts";
import { FachFehler, type Kontext } from "./auth/fehler.ts";
import { findeKonto, listeKonten, type Konto } from "./auth/konten.ts";
import { protokolliere } from "./auth/protokoll.ts";
import { entschluesseln, verschluesseln } from "./crypto.ts";
import { db } from "./db.ts";

/*
  Besetzung: wer vom Team bei einer Veranstaltung dabei ist (Regeln in lib/besetzung.ts).

  - Jedes aktive Mitglied, das Anmeldungen sehen darf, zählt zur Besetzung. Gesperrte Konten nicht, der Superuser
    auch nicht: Er verwaltet nur und fährt nicht mit.
  - Eine Antwort ändert nur das Mitglied selbst. Wer "einsaetze.planen" hat (Admin, Superuser), darf auch für
    andere antworten und die Veranstaltung zur Pflicht machen.
  - Die Notiz ist freier Text und liegt wie alles Personenbezogene verschlüsselt in der Datenbank.
  - Ins Protokoll kommt, was für andere verbindlich ist: Antworten bei einer Pflicht, Eintragungen für andere und
    jede Änderung der Planung. Gewöhnliche Antworten füllen das Protokoll nicht.
*/

function verlange(akteur: Konto, berechtigung: Berechtigung): void {
  if (akteur.status !== "aktiv" || !darf(akteur.rolle, berechtigung)) {
    throw new FachFehler("Dafür fehlt die Berechtigung.");
  }
}

/** Zählt dieses Konto zur Besetzung? */
function zaehltMit(k: Konto): boolean {
  return k.status === "aktiv" && k.rolle !== "superuser" && darf(k.rolle, "anmeldungen.lesen");
}

/** Alle, die zur Besetzung zählen. */
function team(): Konto[] {
  return listeKonten().filter(zaehltMit);
}

type PlanungsZeile = { anmeldung_id: string; pflicht: number; benoetigt: number | null };
type EinsatzZeile = { anmeldung_id: string; konto_id: string; antwort: string; notiz: Buffer | null; zeit: string };

function notizLesen(z: EinsatzZeile): string | null {
  if (!z.notiz) return null;
  try {
    return entschluesseln(z.notiz, `einsatz:${z.anmeldung_id}:${z.konto_id}`).toString("utf8");
  } catch {
    return null; // Eine unlesbare Notiz stört die Anzeige nicht.
  }
}

export type Person = {
  kontoId: string;
  name: string;
  bildVersion: string | null;
  antwort: MeineAntwort;
  notiz: string | null;
};

export type Besetzung = { pflicht: boolean; benoetigt: number | null; personen: Person[] };

/** Die vollständige Besetzung einer Veranstaltung für die Detailseite. Das Mitglied selbst steht zuerst. */
export function ladeBesetzung(akteur: Konto, anmeldungId: string): Besetzung {
  verlange(akteur, "anmeldungen.lesen");
  const plan = db().prepare("SELECT pflicht, benoetigt FROM besetzung WHERE anmeldung_id = ?").get(anmeldungId) as
    | { pflicht: number; benoetigt: number | null }
    | undefined;
  const zeilen = db()
    .prepare("SELECT anmeldung_id, konto_id, antwort, notiz, zeit FROM einsaetze WHERE anmeldung_id = ?")
    .all(anmeldungId) as EinsatzZeile[];
  const nachKonto = new Map(zeilen.map((z) => [z.konto_id, z]));

  const personen = team()
    .map((k): Person => {
      const z = nachKonto.get(k.id);
      return {
        kontoId: k.id,
        name: k.anzeigename,
        bildVersion: k.bildVersion,
        antwort: z && (z.antwort === "dabei" || z.antwort === "nicht_dabei") ? z.antwort : "offen",
        notiz: z ? notizLesen(z) : null,
      };
    })
    // listeKonten ist schon nach Namen sortiert. Man selbst steht zuerst, der Rest bleibt in dieser Reihenfolge,
    // damit nach einer Antwort nichts umspringt.
    .sort((a, b) => Number(b.kontoId === akteur.id) - Number(a.kontoId === akteur.id));
  return { pflicht: plan?.pflicht === 1, benoetigt: plan?.benoetigt ?? null, personen };
}

/** Die Zahlen aller Veranstaltungen auf einmal, für die Übersicht. Wer keinen Eintrag hat, bei dem sind alle offen. */
export function besetzungenFuerListe(akteur: Konto): (anmeldungId: string) => BesetzungKurz {
  verlange(akteur, "anmeldungen.lesen");
  const aktive = new Set(team().map((k) => k.id));
  const plaene = new Map(
    (db().prepare("SELECT anmeldung_id, pflicht, benoetigt FROM besetzung").all() as PlanungsZeile[]).map((p) => [p.anmeldung_id, p]),
  );
  const antworten = new Map<string, Map<string, Antwort>>();
  for (const z of db().prepare("SELECT anmeldung_id, konto_id, antwort FROM einsaetze").all() as Omit<EinsatzZeile, "notiz" | "zeit">[]) {
    if (!aktive.has(z.konto_id) || (z.antwort !== "dabei" && z.antwort !== "nicht_dabei")) continue;
    const pro = antworten.get(z.anmeldung_id) ?? new Map<string, Antwort>();
    pro.set(z.konto_id, z.antwort);
    antworten.set(z.anmeldung_id, pro);
  }

  const leer: BesetzungKurz = { pflicht: false, benoetigt: null, dabei: 0, nichtDabei: 0, offen: aktive.size, meine: aktive.has(akteur.id) ? "offen" : null };
  const ergebnis = new Map<string, BesetzungKurz>();
  const ids = new Set([...plaene.keys(), ...antworten.keys()]);
  for (const id of ids) {
    const pro = antworten.get(id) ?? new Map<string, Antwort>();
    const plan = plaene.get(id);
    const personen = [...aktive].map((kontoId) => ({ antwort: (pro.get(kontoId) ?? "offen") as MeineAntwort }));
    ergebnis.set(id, {
      pflicht: plan?.pflicht === 1,
      benoetigt: plan?.benoetigt ?? null,
      ...zaehle(personen),
      meine: aktive.has(akteur.id) ? (pro.get(akteur.id) ?? "offen") : null,
    });
  }
  return (anmeldungId) => ergebnis.get(anmeldungId) ?? leer;
}

/** Die Veranstaltungen, bei denen das Konto "Dabei" gesagt hat. Für den persönlichen Kalender. */
export function einsatzIdsDabei(kontoId: string): Set<string> {
  const zeilen = db().prepare("SELECT anmeldung_id FROM einsaetze WHERE konto_id = ? AND antwort = 'dabei'").all(kontoId) as {
    anmeldung_id: string;
  }[];
  return new Set(zeilen.map((z) => z.anmeldung_id));
}

function ladeOffene(anmeldungId: string) {
  const anmeldung = findeNachId(anmeldungId);
  if (!anmeldung) throw new FachFehler("Diese Anmeldung gibt es nicht mehr.");
  const grund = besetzungGesperrt(anmeldung.status, anmeldung.values.datum, heuteBerlin());
  if (grund) throw new FachFehler(grund);
  return anmeldung;
}

/** Trägt eine Antwort ein. Ohne "einsaetze.planen" nur für das eigene Konto. */
export function setzeAntwort(
  akteur: Konto,
  anmeldungId: string,
  kontoId: string,
  eingabe: { antwort: unknown; notiz: string },
  kontext: Kontext,
): void {
  verlange(akteur, "anmeldungen.lesen");
  if (kontoId !== akteur.id) verlange(akteur, "einsaetze.planen");
  const anmeldung = ladeOffene(anmeldungId);

  const ziel = findeKonto(kontoId);
  if (!ziel || !zaehltMit(ziel)) {
    throw new FachFehler("Dieses Mitglied gibt es nicht, ist gesperrt oder gehört nicht zur Besetzung.");
  }
  const plan = db().prepare("SELECT pflicht FROM besetzung WHERE anmeldung_id = ?").get(anmeldungId) as { pflicht: number } | undefined;
  const pflicht = plan?.pflicht === 1;
  const notiz = eingabe.notiz.replace(/\r\n/g, "\n").trim();
  const problem = pruefeAntwort(eingabe.antwort, notiz, pflicht);
  if (problem) throw new FachFehler(problem);
  const antwort = eingabe.antwort as Antwort;

  db()
    .prepare(
      `INSERT INTO einsaetze (anmeldung_id, konto_id, antwort, notiz, zeit) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (anmeldung_id, konto_id) DO UPDATE SET antwort = excluded.antwort, notiz = excluded.notiz, zeit = excluded.zeit`,
    )
    .run(
      anmeldungId,
      kontoId,
      antwort,
      notiz ? verschluesseln(notiz, `einsatz:${anmeldungId}:${kontoId}`) : null,
      new Date().toISOString(),
    );

  if (pflicht || kontoId !== akteur.id) {
    protokolliere(
      {
        ereignis: "einsatz.geaendert",
        akteur: { id: akteur.id, name: akteur.anzeigename },
        ziel: { typ: "anmeldung", id: anmeldungId, name: anmeldung.values.titel },
        details: { antwort, ...(kontoId !== akteur.id ? { fuer: ziel.anzeigename } : {}), pflicht: pflicht ? "ja" : "nein" },
      },
      kontext,
    );
  }
}

/** Macht eine Veranstaltung zur Pflicht und legt fest, wie viele Leute gebraucht werden. */
export function setzePlanung(
  akteur: Konto,
  anmeldungId: string,
  eingabe: { pflicht: boolean; benoetigt: unknown },
  kontext: Kontext,
): void {
  verlange(akteur, "einsaetze.planen");
  const anmeldung = findeNachId(anmeldungId);
  if (!anmeldung) throw new FachFehler("Diese Anmeldung gibt es nicht mehr.");
  if (anmeldung.status === "abgelehnt") throw new FachFehler("Diese Anmeldung wurde abgelehnt, dafür braucht es keine Besetzung.");
  const zahl = pruefeBenoetigt(eingabe.benoetigt);
  if (!zahl.ok) throw new FachFehler(zahl.meldung);

  if (!eingabe.pflicht && zahl.benoetigt === null) {
    db().prepare("DELETE FROM besetzung WHERE anmeldung_id = ?").run(anmeldungId);
  } else {
    db()
      .prepare(
        `INSERT INTO besetzung (anmeldung_id, pflicht, benoetigt) VALUES (?, ?, ?)
         ON CONFLICT (anmeldung_id) DO UPDATE SET pflicht = excluded.pflicht, benoetigt = excluded.benoetigt`,
      )
      .run(anmeldungId, eingabe.pflicht ? 1 : 0, zahl.benoetigt);
  }
  protokolliere(
    {
      ereignis: "einsatz.geplant",
      akteur: { id: akteur.id, name: akteur.anzeigename },
      ziel: { typ: "anmeldung", id: anmeldungId, name: anmeldung.values.titel },
      details: { pflicht: eingabe.pflicht ? "ja" : "nein", benoetigt: zahl.benoetigt },
    },
    kontext,
  );
}
