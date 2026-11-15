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
