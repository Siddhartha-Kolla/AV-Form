import "server-only";
import { aufbewahrungProtokollTage } from "../config.ts";
import { entschluesseln, verschluesseln } from "../crypto.ts";
import { db } from "../db.ts";
import type { EreignisId } from "../../protokoll-ereignisse.ts";
import type { Kontext } from "./fehler.ts";

/*
  Protokoll: wer hat wann was getan. Spalten zum Filtern stehen im Klartext
  (Zeit, Ereignis, Akteur-ID, Ziel-ID), Namen, IP-Adresse und Details verschlüsselt.
  Der Akteurname wird mitgespeichert, damit eine Zeile auch nach dem Löschen
  eines Kontos noch verständlich bleibt.

  In "details" gehören nie Passwörter, Tokens oder andere Geheimnisse.
*/

export type ProtokollEintrag = {
  ereignis: EreignisId;
  ergebnis?: "ok" | "fehler";
  akteur?: { id: string; name: string } | null;
  ziel?: { typ: string; id?: string; name?: string } | null;
  details?: Record<string, string | number | boolean | string[] | null>;
};

type Daten = {
  akteurName: string | null;
  zielName: string | null;
  ip: string | null;
  geraet: string | null;
  details: Record<string, unknown>;
};

const VERBOTENE_SCHLUESSEL = /passwort|secret|token|geheimnis/i;

function bereinigt(details: ProtokollEintrag["details"]): Record<string, unknown> {
  const sauber: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    if (!VERBOTENE_SCHLUESSEL.test(k)) sauber[k] = v;
  }
  return sauber;
}

export function protokolliere(eintrag: ProtokollEintrag, kontext: Kontext): void {
  const daten: Daten = {
    akteurName: eintrag.akteur?.name ?? null,
    zielName: eintrag.ziel?.name ?? null,
    ip: kontext.ip,
    geraet: kontext.geraet,
    details: bereinigt(eintrag.details),
  };
  const zeit = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO protokoll (zeit, ereignis, ergebnis, akteur_id, ziel_typ, ziel_id, daten)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      zeit,
      eintrag.ereignis,
      eintrag.ergebnis ?? "ok",
      eintrag.akteur?.id ?? null,
      eintrag.ziel?.typ ?? null,
      eintrag.ziel?.id ?? null,
      // aad enthält nur die Zeit, weil die ID erst nach dem Einfügen feststeht
      verschluesseln(JSON.stringify(daten), `protokoll:${zeit}`),
    );
}

export type ProtokollZeile = {
  id: number;
  zeit: string;
  ereignis: string;
  ergebnis: "ok" | "fehler";
  akteurId: string | null;
  akteurName: string | null;
  zielTyp: string | null;
  zielId: string | null;
  zielName: string | null;
  ip: string | null;
  geraet: string | null;
  details: Record<string, unknown>;
};

type Zeile = {
  id: number;
  zeit: string;
  ereignis: string;
  ergebnis: "ok" | "fehler";
  akteur_id: string | null;
  ziel_typ: string | null;
  ziel_id: string | null;
  daten: Buffer;
};

export function listeProtokoll(filter: {
  ereignisse?: string[];
  akteurId?: string;
  vorId?: number;
  limit?: number;
}): { zeilen: ProtokollZeile[]; hatMehr: boolean } {
  const bedingungen: string[] = [];
  const werte: (string | number)[] = [];
  if (filter.ereignisse && filter.ereignisse.length > 0) {
    bedingungen.push(`ereignis IN (${filter.ereignisse.map(() => "?").join(",")})`);
    werte.push(...filter.ereignisse);
  }
  if (filter.akteurId) {
    bedingungen.push("akteur_id = ?");
    werte.push(filter.akteurId);
  }
  if (filter.vorId) {
    bedingungen.push("id < ?");
    werte.push(filter.vorId);
  }
  const limit = Math.min(filter.limit ?? 50, 200);
  const where = bedingungen.length > 0 ? `WHERE ${bedingungen.join(" AND ")}` : "";
  const zeilen = db()
    .prepare(
      `SELECT id, zeit, ereignis, ergebnis, akteur_id, ziel_typ, ziel_id, daten FROM protokoll ${where}
       ORDER BY id DESC LIMIT ?`,
    )
    .all(...werte, limit + 1) as Zeile[];

  const sichtbar = zeilen.slice(0, limit).map((z): ProtokollZeile => {
    let daten: Daten = { akteurName: null, zielName: null, ip: null, geraet: null, details: {} };
    try {
      daten = JSON.parse(entschluesseln(z.daten, `protokoll:${z.zeit}`).toString("utf8")) as Daten;
    } catch {
      daten.details = { hinweis: "Dieser Eintrag lässt sich nicht entschlüsseln." };
    }
    return {
      id: z.id,
      zeit: z.zeit,
      ereignis: z.ereignis,
      ergebnis: z.ergebnis,
      akteurId: z.akteur_id,
      akteurName: daten.akteurName,
      zielTyp: z.ziel_typ,
      zielId: z.ziel_id,
      zielName: daten.zielName,
      ip: daten.ip,
      geraet: daten.geraet,
      details: daten.details,
    };
  });
  return { zeilen: sichtbar, hatMehr: zeilen.length > limit };
}

/** Distinct-Akteure für den Filter der Protokollseite. */
export function protokollAkteure(): { id: string; name: string }[] {
  const zeilen = db()
    .prepare("SELECT akteur_id AS id, MAX(id) AS letzte FROM protokoll WHERE akteur_id IS NOT NULL GROUP BY akteur_id")
    .all() as { id: string; letzte: number }[];
  const ergebnis: { id: string; name: string }[] = [];
  for (const { id, letzte } of zeilen) {
    const z = db().prepare("SELECT zeit, daten FROM protokoll WHERE id = ?").get(letzte) as {
      zeit: string;
      daten: Buffer;
    };
    try {
      const daten = JSON.parse(entschluesseln(z.daten, `protokoll:${z.zeit}`).toString("utf8")) as Daten;
      ergebnis.push({ id, name: daten.akteurName ?? id });
    } catch {
      ergebnis.push({ id, name: id });
    }
  }
  return ergebnis.sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Löscht Protokollzeilen, die älter als die Aufbewahrungsfrist sind. */
export function loescheAltesProtokoll(heute: Date = new Date()): number {
  const grenze = new Date(heute.getTime() - aufbewahrungProtokollTage() * 86_400_000).toISOString();
  return db().prepare("DELETE FROM protokoll WHERE zeit < ?").run(grenze).changes;
}
