import "server-only";
import { SITZUNG_LEERLAUF_STUNDEN, SITZUNG_MAX_TAGE } from "../config.ts";
import { entschluesseln, neueId, neuesToken, tokenGueltigeForm, tokenHash, verschluesseln } from "../crypto.ts";
import { db } from "../db.ts";
import { findeKonto, type Konto } from "./konten.ts";
import type { Kontext } from "./fehler.ts";

/*
  Sitzungen. Im Cookie steht ein zufälliges Token, in der Datenbank nur dessen Hash.
  Damit gibt es nichts, was sich aus der Datenbank als Cookie wiederverwenden ließe.
  Jede Sitzung endet nach Leerlauf und spätestens nach SITZUNG_MAX_TAGE.
  Gesperrte oder gelöschte Konten verlieren ihre Sitzungen sofort.
*/

export type Sitzung = {
  id: string;
  kontoId: string;
  anbieter: string;
  erstelltAm: string;
  zuletztAktiv: string;
  laeuftAbAm: string;
  geraet: string | null;
};

type Zeile = {
  id: string;
  konto_id: string;
  anbieter: string;
  erstellt_am: string;
  zuletzt_aktiv: string;
  laeuft_ab_am: string;
  geraet: Buffer | null;
};

const SPALTEN = "id, konto_id, anbieter, erstellt_am, zuletzt_aktiv, laeuft_ab_am, geraet";
/** Die Aktivität wird höchstens so oft neu geschrieben. */
const AKTIVITAET_INTERVALL_MS = 5 * 60 * 1000;

function zuSitzung(z: Zeile): Sitzung {
  return {
    id: z.id,
    kontoId: z.konto_id,
    anbieter: z.anbieter,
    erstelltAm: z.erstellt_am,
    zuletztAktiv: z.zuletzt_aktiv,
    laeuftAbAm: z.laeuft_ab_am,
    geraet: z.geraet ? entschluesseln(z.geraet, `sitzung:${z.id}`).toString("utf8") : null,
  };
}

export function erstelleSitzung(
  kontoId: string,
  anbieter: string,
  kontext: Kontext,
  jetzt: Date = new Date(),
): { token: string; laeuftAbAm: Date } {
  const id = neueId();
  const token = neuesToken();
  const laeuftAb = new Date(jetzt.getTime() + SITZUNG_MAX_TAGE * 86_400_000);
  db()
    .prepare(
      `INSERT INTO sitzungen (id, token_hash, konto_id, anbieter, erstellt_am, zuletzt_aktiv, laeuft_ab_am, geraet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      tokenHash(token),
      kontoId,
      anbieter,
      jetzt.toISOString(),
      jetzt.toISOString(),
      laeuftAb.toISOString(),
      kontext.geraet ? verschluesseln(kontext.geraet, `sitzung:${id}`) : null,
    );
  return { token, laeuftAbAm: laeuftAb };
}

/** Liefert die Sitzung samt Konto, wenn das Token gültig ist, sonst null. */
export function pruefeSitzung(token: string, jetzt: Date = new Date()): { sitzung: Sitzung; konto: Konto } | null {
  if (!tokenGueltigeForm(token)) return null;
  const zeile = db().prepare(`SELECT ${SPALTEN} FROM sitzungen WHERE token_hash = ?`).get(tokenHash(token)) as
    | Zeile
    | undefined;
  if (!zeile) return null;

  const leerlaufGrenze = new Date(jetzt.getTime() - SITZUNG_LEERLAUF_STUNDEN * 3_600_000).toISOString();
  const abgelaufen = zeile.laeuft_ab_am <= jetzt.toISOString() || zeile.zuletzt_aktiv < leerlaufGrenze;
  const konto = abgelaufen ? null : findeKonto(zeile.konto_id);
  if (!konto || konto.status !== "aktiv") {
    db().prepare("DELETE FROM sitzungen WHERE id = ?").run(zeile.id);
    return null;
  }

  if (jetzt.getTime() - new Date(zeile.zuletzt_aktiv).getTime() > AKTIVITAET_INTERVALL_MS) {
    db().prepare("UPDATE sitzungen SET zuletzt_aktiv = ? WHERE id = ?").run(jetzt.toISOString(), zeile.id);
    zeile.zuletzt_aktiv = jetzt.toISOString();
  }
  return { sitzung: zuSitzung(zeile), konto };
}

export function beendeSitzung(token: string): void {
  if (tokenGueltigeForm(token)) db().prepare("DELETE FROM sitzungen WHERE token_hash = ?").run(tokenHash(token));
}

/** Beendet alle Sitzungen eines Kontos, auf Wunsch außer einer. Gibt die Anzahl zurück. */
export function beendeAlleSitzungen(kontoId: string, ausserSitzungId?: string): number {
  if (ausserSitzungId) {
    return db().prepare("DELETE FROM sitzungen WHERE konto_id = ? AND id != ?").run(kontoId, ausserSitzungId).changes;
  }
  return db().prepare("DELETE FROM sitzungen WHERE konto_id = ?").run(kontoId).changes;
}

export function listeSitzungen(kontoId: string): Sitzung[] {
  const zeilen = db()
    .prepare(`SELECT ${SPALTEN} FROM sitzungen WHERE konto_id = ? ORDER BY zuletzt_aktiv DESC`)
    .all(kontoId) as Zeile[];
  return zeilen.map(zuSitzung);
}

export function zaehleSitzungen(kontoId: string): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM sitzungen WHERE konto_id = ?").get(kontoId) as { n: number }).n;
}

export function loescheAbgelaufeneSitzungen(jetzt: Date = new Date()): number {
  const leerlauf = new Date(jetzt.getTime() - SITZUNG_LEERLAUF_STUNDEN * 3_600_000).toISOString();
  return db()
    .prepare("DELETE FROM sitzungen WHERE laeuft_ab_am <= ? OR zuletzt_aktiv < ?")
    .run(jetzt.toISOString(), leerlauf).changes;
}
