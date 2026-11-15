import "server-only";
import type { FormValues } from "../registration.ts";
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
  erstelltAm: string;
  geaendertAm: string;
};

export type Aenderung = { zeit: string; felder: string[] };

export type AnmeldungMitZusatz = Anmeldung & { dateien: DateiInfo[]; aenderungen: Aenderung[] };

type Zeile = {
  id: string;
  daten: Buffer;
  revision: number;
  erstellt_am: string;
  geaendert_am: string;
};

const SPALTEN = "id, daten, revision, erstellt_am, geaendert_am";

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

const FELDER_MIT_UNTERPUNKTEN = ["termine"] as const;

/** Namen der Formularfelder, die sich unterscheiden. Termine werden pro Zeile genannt. */
export function geaenderteFelder(alt: FormValues, neu: FormValues): string[] {
  const unterschied: string[] = [];
  for (const key of Object.keys(neu) as (keyof FormValues)[]) {
    if ((FELDER_MIT_UNTERPUNKTEN as readonly string[]).includes(key)) {
      const a = alt[key] as Record<string, unknown>;
      const n = neu[key] as Record<string, unknown>;
      for (const unter of Object.keys(n)) {
        if (JSON.stringify(a?.[unter]) !== JSON.stringify(n[unter])) unterschied.push(`${key}.${unter}`);
      }
    } else if (JSON.stringify(alt[key]) !== JSON.stringify(neu[key])) {
      unterschied.push(key);
    }
  }
  return unterschied;
}

/** Speichert Änderungen und vermerkt, welche Felder sich geändert haben. */
export function aktualisiereAnmeldung(id: string, values: FormValues): { geaendert: string[] } | null {
  return db().transaction(() => {
    const zeile = db().prepare(`SELECT ${SPALTEN} FROM anmeldungen WHERE id = ?`).get(id) as Zeile | undefined;
    if (!zeile) return null;
    const felder = geaenderteFelder(zuAnmeldung(zeile).values, values);
    if (felder.length === 0) return { geaendert: [] };
    const jetztIso = jetzt();
    db()
      .prepare(
        "UPDATE anmeldungen SET email_hash = ?, datum = ?, daten = ?, revision = revision + 1, geaendert_am = ? WHERE id = ?",
      )
      .run(emailHash(values.email), values.datum, verpacken(id, values), jetztIso, id);
    db()
      .prepare("INSERT INTO aenderungen (anmeldung_id, zeit, felder) VALUES (?, ?, ?)")
      .run(id, jetztIso, JSON.stringify(felder));
    return { geaendert: felder };
  })();
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
    .prepare("SELECT anmeldung_id, zeit, felder FROM aenderungen ORDER BY zeit DESC, id DESC")
    .all() as { anmeldung_id: string; zeit: string; felder: string }[];
  const nachId = new Map<string, Aenderung[]>();
  for (const a of aenderungen) {
    const liste = nachId.get(a.anmeldung_id) ?? [];
    liste.push({ zeit: a.zeit, felder: JSON.parse(a.felder) as string[] });
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
