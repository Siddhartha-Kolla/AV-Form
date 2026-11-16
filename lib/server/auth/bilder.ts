import "server-only";
import { randomBytes } from "node:crypto";
import { istBildTyp, pruefeBild, type BildTyp } from "../../konto-bild.ts";
import { db } from "../db.ts";
import { entschluesseln, verschluesseln } from "../crypto.ts";
import { FachFehler, type Kontext } from "./fehler.ts";
import type { Konto } from "./konten.ts";
import { protokolliere } from "./protokoll.ts";

/*
  Profilbilder der Teammitglieder. Das Bild liegt verschlüsselt in der Datenbank, wie alle anderen
  personenbezogenen Daten. In der Kontenliste steht nur eine Versionskennung (bild_version), damit
  die Adresse des Bildes sich ändert, sobald es ein neues gibt, und Browser das alte nicht behalten.

  Jedes Mitglied ändert nur das eigene Bild. Ein Bild ist nur für angemeldete Teammitglieder abrufbar.
*/

function ziel(konto: Konto) {
  return { typ: "konto", id: konto.id, name: konto.anzeigename };
}

/** Speichert oder ersetzt das Bild des Kontos. Prüft Größe und Format selbst. */
export function speichereKontoBild(konto: Konto, bytes: Buffer, kontext: Kontext): string {
  const pruefung = pruefeBild(bytes);
  if (!pruefung.ok) throw new FachFehler(pruefung.meldung);
  const version = randomBytes(6).toString("hex");
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO konto_bilder (konto_id, typ, daten) VALUES (?, ?, ?)
         ON CONFLICT (konto_id) DO UPDATE SET typ = excluded.typ, daten = excluded.daten`,
      )
      .run(konto.id, pruefung.typ, verschluesseln(bytes, `kontobild:${konto.id}`));
    db().prepare("UPDATE konten SET bild_version = ? WHERE id = ?").run(version, konto.id);
  })();
  protokolliere({ ereignis: "konto.bild_geaendert", akteur: { id: konto.id, name: konto.anzeigename }, ziel: ziel(konto) }, kontext);
  return version;
}

export function entferneKontoBild(konto: Konto, kontext: Kontext): void {
  db().transaction(() => {
    db().prepare("DELETE FROM konto_bilder WHERE konto_id = ?").run(konto.id);
    db().prepare("UPDATE konten SET bild_version = NULL WHERE id = ?").run(konto.id);
  })();
  protokolliere({ ereignis: "konto.bild_entfernt", akteur: { id: konto.id, name: konto.anzeigename }, ziel: ziel(konto) }, kontext);
}

export function ladeKontoBild(kontoId: string): { typ: BildTyp; daten: Buffer; version: string } | null {
  const z = db()
    .prepare(
      `SELECT b.typ, b.daten, k.bild_version FROM konto_bilder b JOIN konten k ON k.id = b.konto_id WHERE b.konto_id = ?`,
    )
    .get(kontoId) as { typ: string; daten: Buffer; bild_version: string | null } | undefined;
  if (!z || !z.bild_version || !istBildTyp(z.typ)) return null;
  try {
    return { typ: z.typ, daten: entschluesseln(z.daten, `kontobild:${kontoId}`), version: z.bild_version };
  } catch {
    // Ein unlesbares Bild ist kein Grund, die Seite zu stören: Es erscheinen dann die Initialen.
    return null;
  }
}
