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
  // Version 3: Wer hat eine Anmeldung geändert, mit welcher Notiz und welchen Dateien
  `
  ALTER TABLE aenderungen ADD COLUMN akteur_id TEXT;
  ALTER TABLE aenderungen ADD COLUMN daten BLOB;
  `,
  // Version 4: Entscheidung des Teams (annehmen, Rückfrage, ablehnen) samt Verlauf mit Nachricht
  `
  ALTER TABLE anmeldungen ADD COLUMN status TEXT NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu', 'angenommen', 'rueckfrage', 'abgelehnt'));

  CREATE TABLE entscheidungen (
    id           INTEGER PRIMARY KEY,
    anmeldung_id TEXT NOT NULL REFERENCES anmeldungen (id) ON DELETE CASCADE,
    zeit         TEXT NOT NULL,
    status       TEXT NOT NULL,
    akteur_id    TEXT,
    daten        BLOB NOT NULL
  ) STRICT;
  CREATE INDEX entscheidungen_anmeldung ON entscheidungen (anmeldung_id);
  `,
  // Version 5: Profilbilder der Teammitglieder. bild_version ändert sich mit jedem neuen Bild.
  `
  ALTER TABLE konten ADD COLUMN bild_version TEXT;

  CREATE TABLE konto_bilder (
    konto_id TEXT PRIMARY KEY REFERENCES konten (id) ON DELETE CASCADE,
    typ      TEXT NOT NULL CHECK (typ IN ('image/jpeg', 'image/png', 'image/webp')),
    daten    BLOB NOT NULL
  ) STRICT;
  `,
  // Version 6: Besetzung. Wer vom Team bei einer Veranstaltung dabei ist, und ob sie Pflicht ist.
  // Einen Eintrag in "einsaetze" gibt es nur, wenn jemand geantwortet hat. Wer fehlt, ist "offen".
  `
  CREATE TABLE besetzung (
    anmeldung_id TEXT PRIMARY KEY REFERENCES anmeldungen (id) ON DELETE CASCADE,
    pflicht      INTEGER NOT NULL DEFAULT 0 CHECK (pflicht IN (0, 1)),
    benoetigt    INTEGER CHECK (benoetigt IS NULL OR benoetigt BETWEEN 1 AND 50)
  ) STRICT;

  CREATE TABLE einsaetze (
    anmeldung_id TEXT NOT NULL REFERENCES anmeldungen (id) ON DELETE CASCADE,
    konto_id     TEXT NOT NULL REFERENCES konten (id) ON DELETE CASCADE,
    antwort      TEXT NOT NULL CHECK (antwort IN ('dabei', 'nicht_dabei')),
    notiz        BLOB,
    zeit         TEXT NOT NULL,
    PRIMARY KEY (anmeldung_id, konto_id)
  ) STRICT;
  CREATE INDEX einsaetze_konto ON einsaetze (konto_id);
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
