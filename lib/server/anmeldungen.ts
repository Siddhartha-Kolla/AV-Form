import "server-only";
import { geaenderteFelder } from "../dashboard.ts";
import { istStatus, type Entscheidung, type StatusId } from "../entscheidung.ts";
import type { FormValues } from "../registration.ts";
import { FachFehler } from "./auth/fehler.ts";
import { aufbewahrungMonate } from "./config.ts";
import {
  emailHash,
  emailHashes,
  entschluesseln,
  neueId,
  neuesToken,
  tokenGueltigeForm,
  tokenHash,
  verschluesseln,
} from "./crypto.ts";
import { db } from "./db.ts";
import { entferneDateienVonDisk, listeDateien, type DateiInfo } from "./dateien.ts";

export type Anmeldung = {
  id: string;
  values: FormValues;
  revision: number;
  status: StatusId;
  erstelltAm: string;
  geaendertAm: string;
};

export type Aenderung = {
  zeit: string;
  felder: string[];
  /** Wer die Änderung eingetragen hat. Leer bei Änderungen der Lehrkraft und bei älteren Einträgen. */
  von: string | null;
  notiz: string | null;
  dateienHinzu: string[];
  dateienWeg: string[];
};

export type AnmeldungMitZusatz = Anmeldung & { dateien: DateiInfo[]; aenderungen: Aenderung[] };

type Zeile = {
  id: string;
  daten: Buffer;
  revision: number;
  status: string;
  erstellt_am: string;
  geaendert_am: string;
};

const SPALTEN = "id, daten, revision, status, erstellt_am, geaendert_am";

function jetzt(): string {
  return new Date().toISOString();
}

function zuAnmeldung(z: Zeile): Anmeldung {
  const inhalt = JSON.parse(entschluesseln(z.daten, `anmeldung:${z.id}`).toString("utf8")) as {
    v: number;
    values: FormValues;
  };
  return {
    id: z.id,
    values: inhalt.values,
    revision: z.revision,
    status: istStatus(z.status) ? z.status : "neu",
    erstelltAm: z.erstellt_am,
    geaendertAm: z.geaendert_am,
  };
}

function verpacken(id: string, values: FormValues): Buffer {
  return verschluesseln(JSON.stringify({ v: 1, values }), `anmeldung:${id}`);
}

/** Legt eine Anmeldung an. Das Token geht per E-Mail an die Lehrkraft und wird nicht gespeichert. */
export function erstelleAnmeldung(values: FormValues): { id: string; token: string } {
  const id = neueId();
  const token = neuesToken();
  const jetztIso = jetzt();
  db()
    .prepare(
      `INSERT INTO anmeldungen (id, token_hash, email_hash, datum, daten, revision, erstellt_am, geaendert_am)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(id, tokenHash(token), emailHash(values.email), values.datum, verpacken(id, values), jetztIso, jetztIso);
  return { id, token };
}

/** Zugriff der Lehrkraft über den privaten Link. */
export function findeNachToken(token: string): Anmeldung | null {
  if (!tokenGueltigeForm(token)) return null;
  const zeile = db().prepare(`SELECT ${SPALTEN} FROM anmeldungen WHERE token_hash = ?`).get(tokenHash(token)) as
    | Zeile
    | undefined;
  return zeile ? zuAnmeldung(zeile) : null;
}

/** Zugriff des Technikteams. Der Aufrufer muss vorher die Team-Anmeldung geprüft haben. */
export function findeNachId(id: string): Anmeldung | null {
  const zeile = db().prepare(`SELECT ${SPALTEN} FROM anmeldungen WHERE id = ?`).get(id) as Zeile | undefined;
  return zeile ? zuAnmeldung(zeile) : null;
}

export type AenderungsOptionen = {
  akteur?: { id: string; name: string } | null;
  /** Freier Vermerk, zum Beispiel "per E-Mail von Frau Beispiel gemeldet". */
  notiz?: string;
  /** Stand, auf dem die Bearbeitung beruht. Hat sich die Anmeldung inzwischen geändert, wird abgelehnt. */
  erwarteteRevision?: number;
  dateienHinzu?: string[];
  dateienWeg?: string[];
};

/**
 * Speichert Änderungen und vermerkt, was sich geändert hat, von wem und mit welcher Notiz.
 * Auch eine Änderung nur an den Dateien gilt als Änderung.
 */
export function aktualisiereAnmeldung(
  id: string,
  values: FormValues,
  optionen: AenderungsOptionen = {},
): { geaendert: string[] } | null {
  return db().transaction(() => {
    const zeile = db().prepare(`SELECT ${SPALTEN} FROM anmeldungen WHERE id = ?`).get(id) as Zeile | undefined;
    if (!zeile) return null;
    if (optionen.erwarteteRevision !== undefined && zeile.revision !== optionen.erwarteteRevision) {
      throw new FachFehler(
        "Diese Anmeldung wurde inzwischen geändert. Die Seite bitte neu laden, damit nichts überschrieben wird.",
      );
    }
    const felder = geaenderteFelder(zuAnmeldung(zeile).values, values);
    if (optionen.dateienHinzu?.length) felder.push("datei+");
    if (optionen.dateienWeg?.length) felder.push("datei-");
    if (felder.length === 0) return { geaendert: [] };

    const jetztIso = jetzt();
    db()
      .prepare(
        "UPDATE anmeldungen SET email_hash = ?, datum = ?, daten = ?, revision = revision + 1, geaendert_am = ? WHERE id = ?",
      )
      .run(emailHash(values.email), values.datum, verpacken(id, values), jetztIso, id);
    const zusatz = {
      von: optionen.akteur?.name ?? null,
      notiz: optionen.notiz?.trim() || null,
      dateienHinzu: optionen.dateienHinzu ?? [],
      dateienWeg: optionen.dateienWeg ?? [],
    };
    db()
      .prepare("INSERT INTO aenderungen (anmeldung_id, zeit, felder, akteur_id, daten) VALUES (?, ?, ?, ?, ?)")
      .run(
        id,
        jetztIso,
        JSON.stringify(felder),
        optionen.akteur?.id ?? null,
        verschluesseln(JSON.stringify(zusatz), `aenderung:${id}:${jetztIso}`),
      );
    // Ändert die Lehrkraft selbst etwas, muss das Team noch einmal hinsehen. Abgelehntes bleibt abgelehnt.
    if (!optionen.akteur && (zeile.status === "angenommen" || zeile.status === "rueckfrage")) {
      setzeStatus(id, "neu", null, { von: null, nachricht: null }, jetztIso);
    }
    return { geaendert: felder };
  })();
}

/* Entscheidungen des Teams --------------------------------------------------- */

export type EntscheidungsEintrag = {
  zeit: string;
  status: StatusId;
  /** Wer entschieden hat. Leer, wenn die Anmeldung durch eine Änderung der Lehrkraft wieder auf "Zu prüfen" gesetzt wurde. */
  von: string | null;
  nachricht: string | null;
};

function setzeStatus(
  id: string,
  status: StatusId,
  akteurId: string | null,
  zusatz: { von: string | null; nachricht: string | null },
  zeit: string,
): void {
  db().prepare("UPDATE anmeldungen SET status = ? WHERE id = ?").run(status, id);
  db()
    .prepare("INSERT INTO entscheidungen (anmeldung_id, zeit, status, akteur_id, daten) VALUES (?, ?, ?, ?, ?)")
    .run(id, zeit, status, akteurId, verschluesseln(JSON.stringify(zusatz), `entscheidung:${id}:${zeit}`));
}

/**
 * Hält die Entscheidung des Teams fest. "erwarteterStatus" ist der Stand, den die Person gesehen hat.
 * Hat inzwischen jemand anderes entschieden, wird abgelehnt, damit sich zwei Personen nicht überstimmen.
 */
export function entscheideAnmeldung(
  id: string,
  optionen: {
    status: Entscheidung;
    nachricht: string;
    erwarteterStatus: StatusId;
    akteur: { id: string; name: string };
  },
): { vorher: StatusId } | null {
  return db().transaction(() => {
    const zeile = db().prepare("SELECT status FROM anmeldungen WHERE id = ?").get(id) as { status: string } | undefined;
    if (!zeile) return null;
    if (zeile.status !== optionen.erwarteterStatus) {
      throw new FachFehler("Jemand hat inzwischen über diese Anmeldung entschieden. Bitte lade die Seite neu.");
    }
    setzeStatus(
      id,
      optionen.status,
      optionen.akteur.id,
      { von: optionen.akteur.name, nachricht: optionen.nachricht.trim() || null },
      jetzt(),
    );
    return { vorher: zeile.status as StatusId };
  })();
}

/** Der Verlauf der Entscheidungen, neueste zuerst. */
export function listeEntscheidungen(anmeldungId: string): EntscheidungsEintrag[] {
  const zeilen = db()
    .prepare("SELECT zeit, status, daten FROM entscheidungen WHERE anmeldung_id = ? ORDER BY zeit DESC, id DESC")
    .all(anmeldungId) as { zeit: string; status: string; daten: Buffer }[];
  return zeilen.map((z) => {
    let zusatz = { von: null as string | null, nachricht: null as string | null };
    try {
      zusatz = JSON.parse(entschluesseln(z.daten, `entscheidung:${anmeldungId}:${z.zeit}`).toString("utf8"));
    } catch {
      // Ein unlesbarer Zusatz ändert nichts an der Entscheidung selbst.
    }
    return { zeit: z.zeit, status: istStatus(z.status) ? z.status : "neu", ...zusatz };
  });
}

type AenderungsZeile = {
  anmeldung_id: string;
  zeit: string;
  felder: string;
  daten: Buffer | null;
};

function zuAenderung(a: AenderungsZeile): Aenderung {
  let zusatz = { von: null as string | null, notiz: null as string | null, dateienHinzu: [] as string[], dateienWeg: [] as string[] };
  if (a.daten) {
    try {
      zusatz = JSON.parse(entschluesseln(a.daten, `aenderung:${a.anmeldung_id}:${a.zeit}`).toString("utf8"));
    } catch {
      // Ein unlesbarer Zusatz ändert nichts an der Tatsache, dass sich etwas geändert hat.
    }
  }
  return { zeit: a.zeit, felder: JSON.parse(a.felder) as string[], ...zusatz };
}

/** Der Verlauf einer Anmeldung, neueste Änderung zuerst. */
export function listeAenderungen(anmeldungId: string): Aenderung[] {
  const zeilen = db()
    .prepare("SELECT anmeldung_id, zeit, felder, daten FROM aenderungen WHERE anmeldung_id = ? ORDER BY zeit DESC, id DESC")
    .all(anmeldungId) as AenderungsZeile[];
  return zeilen.map(zuAenderung);
}

/**
 * "Link verloren": setzt für jede passende, noch nicht abgelaufene Anmeldung ein neues Token.
 * Der alte Link ist danach ungültig. Die Tokens gehören in eine E-Mail an die Adresse, nie in die Antwort.
 */
export function neueZugangslinks(email: string, heuteIso: string): { id: string; titel: string; token: string }[] {
  const hashes = emailHashes(email);
  const zeilen = db()
    .prepare(
      `SELECT ${SPALTEN} FROM anmeldungen WHERE datum >= ? AND email_hash IN (${hashes.map(() => "?").join(",")})`,
    )
    .all(heuteIso, ...hashes) as Zeile[];
  return zeilen.map((zeile) => {
    const token = neuesToken();
    db().prepare("UPDATE anmeldungen SET token_hash = ? WHERE id = ?").run(tokenHash(token), zeile.id);
    return { id: zeile.id, titel: zuAnmeldung(zeile).values.titel, token };
  });
}

/**
 * Alle Anmeldungen fürs Team, nach Veranstaltungsdatum sortiert.
 * Eine Zeile, die sich nicht entschlüsseln lässt, blockiert nicht die ganze Liste.
 * Ihre IDs stehen in "unlesbar", damit die Übersicht darauf hinweisen kann.
 */
export function listeAnmeldungen(): { anmeldungen: AnmeldungMitZusatz[]; unlesbar: string[] } {
  const zeilen = db().prepare(`SELECT ${SPALTEN} FROM anmeldungen ORDER BY datum, erstellt_am`).all() as Zeile[];
  const aenderungen = db()
    .prepare("SELECT anmeldung_id, zeit, felder, daten FROM aenderungen ORDER BY zeit DESC, id DESC")
    .all() as AenderungsZeile[];
  const nachId = new Map<string, Aenderung[]>();
  for (const a of aenderungen) {
    const liste = nachId.get(a.anmeldung_id) ?? [];
    liste.push(zuAenderung(a));
    nachId.set(a.anmeldung_id, liste);
  }

  const anmeldungen: AnmeldungMitZusatz[] = [];
  const unlesbar: string[] = [];
  for (const z of zeilen) {
    try {
      anmeldungen.push({ ...zuAnmeldung(z), dateien: listeDateien(z.id), aenderungen: nachId.get(z.id) ?? [] });
    } catch (fehler) {
      console.error(`Anmeldung ${z.id} lässt sich nicht lesen:`, fehler instanceof Error ? fehler.message : fehler);
      unlesbar.push(z.id);
    }
  }
  return { anmeldungen, unlesbar };
}

/**
 * Die belegten Termine für die öffentliche Belegungsanzeige: nur Datum und Uhrzeit, nichts sonst.
 * Abgelehntes steht nicht im Zeitplan und zählt nicht.
 */
export function listeBelegung(vonIso: string, bisIso: string): { datum: string; beginn: string; ende: string }[] {
  const zeilen = db()
    .prepare(
      `SELECT ${SPALTEN} FROM anmeldungen WHERE datum >= ? AND datum <= ? AND status != 'abgelehnt' ORDER BY datum`,
    )
    .all(vonIso, bisIso) as Zeile[];
  const ergebnis: { datum: string; beginn: string; ende: string }[] = [];
  for (const z of zeilen) {
    try {
      const { datum, beginn, ende } = zuAnmeldung(z).values;
      ergebnis.push({ datum, beginn, ende });
    } catch {
      // Eine unlesbare Zeile soll die Anzeige für alle anderen nicht verhindern.
    }
  }
  return ergebnis;
}

export function loescheAnmeldung(id: string): boolean {
  entferneDateienVonDisk(id);
  return db().prepare("DELETE FROM anmeldungen WHERE id = ?").run(id).changes > 0;
}

function monateZurueck(heute: Date, monate: number): string {
  const d = new Date(heute.getFullYear(), heute.getMonth() - monate, heute.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Löscht Anmeldungen und Dateien, deren Veranstaltung länger als die Aufbewahrungsfrist zurückliegt. */
export function loescheAbgelaufene(heute: Date = new Date()): number {
  const grenze = monateZurueck(heute, aufbewahrungMonate());
  const ids = db().prepare("SELECT id FROM anmeldungen WHERE datum < ?").all(grenze) as { id: string }[];
  for (const { id } of ids) loescheAnmeldung(id);
  return ids.length;
}
