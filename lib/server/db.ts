import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { dataDir, dateienDir } from "./config.ts";

/*
  Schema. Nur das Datum liegt im Klartext, damit sortiert und aufgeräumt werden kann.
  Alles andere steckt verschlüsselt in "daten". Tokens und E-Mail-Adressen stehen nur
  als Hash in der Tabelle.
*/
const MIGRATIONEN: string[] = [
  `
  CREATE TABLE anmeldungen (
    id           TEXT PRIMARY KEY,
    token_hash   TEXT NOT NULL UNIQUE,
    email_hash   TEXT NOT NULL,
    datum        TEXT NOT NULL,
    daten        BLOB NOT NULL,
    revision     INTEGER NOT NULL DEFAULT 1,
    erstellt_am  TEXT NOT NULL,
    geaendert_am TEXT NOT NULL
  ) STRICT;
  CREATE INDEX anmeldungen_datum ON anmeldungen (datum);
  CREATE INDEX anmeldungen_email_hash ON anmeldungen (email_hash);

  CREATE TABLE dateien (
    id           TEXT PRIMARY KEY,
    anmeldung_id TEXT NOT NULL REFERENCES anmeldungen (id) ON DELETE CASCADE,
    name         BLOB NOT NULL,
    groesse      INTEGER NOT NULL,
    erstellt_am  TEXT NOT NULL
  ) STRICT;
  CREATE INDEX dateien_anmeldung ON dateien (anmeldung_id);

  CREATE TABLE aenderungen (
    id           INTEGER PRIMARY KEY,
    anmeldung_id TEXT NOT NULL REFERENCES anmeldungen (id) ON DELETE CASCADE,
    zeit         TEXT NOT NULL,
    felder       TEXT NOT NULL
  ) STRICT;
  CREATE INDEX aenderungen_anmeldung ON aenderungen (anmeldung_id);
  `,
  // Version 2: Konten, Anmeldeanbieter, Sitzungen, Drosselung, Protokoll
  `
  CREATE TABLE konten (
    id                    TEXT PRIMARY KEY,
    benutzername_hash     TEXT NOT NULL UNIQUE,
    daten                 BLOB NOT NULL,
    rolle                 TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'gesperrt')),
    muss_passwort_aendern INTEGER NOT NULL DEFAULT 0,
    erstellt_am           TEXT NOT NULL,
    geaendert_am          TEXT NOT NULL,
    letzter_login         TEXT
  ) STRICT;
  CREATE UNIQUE INDEX nur_ein_superuser ON konten (rolle) WHERE rolle = 'superuser';

  CREATE TABLE identitaeten (
    id           TEXT PRIMARY KEY,
    konto_id     TEXT NOT NULL REFERENCES konten (id) ON DELETE CASCADE,
    anbieter     TEXT NOT NULL,
    subjekt_hash TEXT NOT NULL,
    geheimnis    BLOB,
    erstellt_am  TEXT NOT NULL,
    UNIQUE (anbieter, subjekt_hash)
  ) STRICT;
  CREATE INDEX identitaeten_konto ON identitaeten (konto_id);

  CREATE TABLE sitzungen (
    id            TEXT PRIMARY KEY,
    token_hash    TEXT NOT NULL UNIQUE,
    konto_id      TEXT NOT NULL REFERENCES konten (id) ON DELETE CASCADE,
    anbieter      TEXT NOT NULL,
    erstellt_am   TEXT NOT NULL,
    zuletzt_aktiv TEXT NOT NULL,
    laeuft_ab_am  TEXT NOT NULL,
    geraet        BLOB
  ) STRICT;
  CREATE INDEX sitzungen_konto ON sitzungen (konto_id);

  CREATE TABLE login_versuche (
    id         INTEGER PRIMARY KEY,
    zeit       TEXT NOT NULL,
    schluessel TEXT NOT NULL
  ) STRICT;
  CREATE INDEX login_versuche_schluessel ON login_versuche (schluessel, zeit);

  CREATE TABLE protokoll (
    id        INTEGER PRIMARY KEY,
    zeit      TEXT NOT NULL,
    ereignis  TEXT NOT NULL,
    ergebnis  TEXT NOT NULL CHECK (ergebnis IN ('ok', 'fehler')),
    akteur_id TEXT,
    ziel_typ  TEXT,
    ziel_id   TEXT,
    daten     BLOB NOT NULL
  ) STRICT;
  CREATE INDEX protokoll_zeit ON protokoll (zeit);
  CREATE INDEX protokoll_ereignis ON protokoll (ereignis, zeit);
  CREATE INDEX protokoll_akteur ON protokoll (akteur_id, zeit);
  `,
];

const global = globalThis as unknown as { __technikDb?: Database.Database };

export function db(): Database.Database {
  if (global.__technikDb) return global.__technikDb;

  fs.mkdirSync(dataDir(), { recursive: true, mode: 0o700 });
  fs.mkdirSync(dateienDir(), { recursive: true, mode: 0o700 });

  const datei = path.join(dataDir(), "technik.db");
  const verbindung = new Database(datei);
  try {
    fs.chmodSync(datei, 0o600);
  } catch {
    // Unter Windows ohne Wirkung.
  }

  verbindung.pragma("journal_mode = WAL");
  verbindung.pragma("synchronous = NORMAL");
  verbindung.pragma("foreign_keys = ON");
  verbindung.pragma("busy_timeout = 5000");
  verbindung.pragma("secure_delete = ON"); // gelöschte Inhalte werden überschrieben
  verbindung.pragma("trusted_schema = OFF");

  migrieren(verbindung);
  global.__technikDb = verbindung;
  return verbindung;
}

function migrieren(verbindung: Database.Database): void {
  const stand = verbindung.pragma("user_version", { simple: true }) as number;
  for (let v = stand; v < MIGRATIONEN.length; v++) {
    verbindung.transaction(() => {
      verbindung.exec(MIGRATIONEN[v]);
      verbindung.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/** Für Tests und Skripte: Datei sauber schließen. */
export function dbSchliessen(): void {
  if (global.__technikDb) {
    global.__technikDb.close();
    global.__technikDb = undefined;
  }
}
