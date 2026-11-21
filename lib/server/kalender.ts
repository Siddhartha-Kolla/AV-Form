import "server-only";
import { darf } from "../berechtigungen.ts";
import { baueKalender, datumPlus, ereignisseFuerAnmeldung, type KalenderEreignis } from "../kalender.ts";
import { heuteBerlin } from "../format.ts";
import { findeNachId, listeAnmeldungen } from "./anmeldungen.ts";
import { FachFehler, type Kontext } from "./auth/fehler.ts";
import { istGedrosselt, registriereVersuch } from "./auth/drosselung.ts";
import { findeKonto, type Konto } from "./auth/konten.ts";
import { protokolliere } from "./auth/protokoll.ts";
import { appUrl } from "./config.ts";
import { entschluesseln, neuesToken, tokenGueltigeForm, tokenHash, verschluesseln } from "./crypto.ts";
import { db } from "./db.ts";
import { besetzungenFuerListe, einsatzIdsDabei } from "./einsaetze.ts";

/*
  Kalender zum Abonnieren. Jedes Teammitglied kann sich einen privaten Link erzeugen und in Google, Apple oder
  Outlook eintragen. Der Link ist das Passwort: Programme können sich nicht anmelden, also steht ein geheimes
  Token in der Adresse.

  - Das Token hat 256 Bit Zufall. In der Datenbank steht sein Hash zum Nachschlagen und das Token verschlüsselt,
    damit die Kontoseite den Link wieder anzeigen kann.
  - Ein neuer Link macht den alten ungültig. Wird ein Konto gesperrt, gelöscht oder verliert die Berechtigung,
    liefert der Link nichts mehr.
  - Im Kalender stehen nur angenommene Veranstaltungen. Hat die Lehrkraft eine angenommene Anmeldung geändert,
    steht sie wieder auf "Zu prüfen". Damit der Termin nicht aus allen Kalendern verschwindet, bleibt er drin,
    bis das Team anders entscheidet.
  - Abrufe sind begrenzt. Der Inhalt ist knapp gehalten (siehe lib/kalender.ts).
*/

export type KalenderInhalt = "alle" | "meine";

/** Wer einen Kalender haben darf: aktive Konten, die Anmeldungen sehen dürfen. */
function darfKalender(k: Konto | null): k is Konto {
  return !!k && k.status === "aktiv" && darf(k.rolle, "anmeldungen.lesen");
}

type LinkZeile = { token_verschl: Buffer; erzeugt_am: string; zuletzt_abgerufen: string | null };

/** Der Link des Kontos, falls es einen gibt. */
export function ladeKalenderLink(konto: Konto): { token: string; erzeugtAm: string; zuletztAbgerufen: string | null } | null {
  const z = db()
    .prepare("SELECT token_verschl, erzeugt_am, zuletzt_abgerufen FROM kalender_links WHERE konto_id = ?")
    .get(konto.id) as LinkZeile | undefined;
  if (!z) return null;
  try {
    return {
      token: entschluesseln(z.token_verschl, `kalender:${konto.id}`).toString("utf8"),
      erzeugtAm: z.erzeugt_am,
      zuletztAbgerufen: z.zuletzt_abgerufen,
    };
  } catch {
    return null; // Ein unlesbarer Link lässt sich neu erzeugen.
  }
}

/** Erzeugt einen neuen Link. Ein vorhandener wird dadurch ungültig. */
export function erzeugeKalenderLink(konto: Konto, kontext: Kontext): string {
  if (!darfKalender(konto)) throw new FachFehler("Dafür fehlt die Berechtigung.");
  const token = neuesToken();
  db()
    .prepare(
      `INSERT INTO kalender_links (konto_id, token_hash, token_verschl, erzeugt_am, zuletzt_abgerufen) VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT (konto_id) DO UPDATE SET token_hash = excluded.token_hash, token_verschl = excluded.token_verschl,
         erzeugt_am = excluded.erzeugt_am, zuletzt_abgerufen = NULL`,
    )
    .run(konto.id, tokenHash(token), verschluesseln(token, `kalender:${konto.id}`), new Date().toISOString());
  protokolliere(
    { ereignis: "kalender.link_erzeugt", akteur: { id: konto.id, name: konto.anzeigename }, ziel: { typ: "konto", id: konto.id, name: konto.anzeigename } },
    kontext,
  );
  return token;
}

export function loescheKalenderLink(konto: Konto, kontext: Kontext): void {
  const n = db().prepare("DELETE FROM kalender_links WHERE konto_id = ?").run(konto.id).changes;
  if (n > 0) {
    protokolliere(
      { ereignis: "kalender.link_entfernt", akteur: { id: konto.id, name: konto.anzeigename }, ziel: { typ: "konto", id: konto.id, name: konto.anzeigename } },
      kontext,
    );
  }
}

/**
 * Angenommen, oder wieder auf "Zu prüfen", weil die Lehrkraft nach der Annahme etwas geändert hat.
 * Bei Rückfrage und Ablehnung ist es nicht mehr dabei.
 */
function kalenderIds(): Set<string> {
  const zeilen = db()
    .prepare(
      `SELECT a.id FROM anmeldungen a
       WHERE a.status = 'angenommen'
          OR (a.status = 'neu' AND (
               SELECT e.status FROM entscheidungen e
               WHERE e.anmeldung_id = a.id AND e.status <> 'neu'
               ORDER BY e.zeit DESC, e.id DESC LIMIT 1) = 'angenommen')`,
    )
    .all() as { id: string }[];
  return new Set(zeilen.map((z) => z.id));
}

/** Die Veranstaltungen, die ein Kalender zeigt: ab 30 Tagen zurück, damit die Datei klein bleibt. */
function ereignisseFuer(konto: Konto, inhalt: KalenderInhalt, jetzt: Date): KalenderEreignis[] {
  const ab = datumPlus(heuteBerlin(jetzt), -30);
  const erlaubt = kalenderIds();
  const dabei = inhalt === "meine" ? einsatzIdsDabei(konto.id) : null;
  const besetzungVon = besetzungenFuerListe(konto);
  const basisUrl = appUrl();

  const ereignisse: KalenderEreignis[] = [];
  for (const a of listeAnmeldungen().anmeldungen) {
    if (!erlaubt.has(a.id) || a.values.datum < ab) continue;
    if (dabei && !dabei.has(a.id)) continue;
    const b = besetzungVon(a.id);
    // Eine Erinnerung am Vortag bekommt, wer in seinem Kalender nur eigene Einsätze hat, und alle bei einer Pflicht.
    ereignisse.push(...ereignisseFuerAnmeldung(a, { basisUrl, besetzung: b, erinnerung: inhalt === "meine" || b.pflicht }));
  }
  return ereignisse;
}

export type KalenderAbruf = { ergebnis: "ok"; ics: string } | { ergebnis: "unbekannt" } | { ergebnis: "gedrosselt" };

/** Der Kalender zu einem Link. "unbekannt" gilt auch für gesperrte Konten, damit nichts verrät, ob es den Link gab. */
export function kalenderFuerToken(token: string, inhalt: KalenderInhalt, jetzt: Date = new Date()): KalenderAbruf {
  if (!tokenGueltigeForm(token)) return { ergebnis: "unbekannt" };
  const hash = tokenHash(token);
  const z = db().prepare("SELECT konto_id, zuletzt_abgerufen FROM kalender_links WHERE token_hash = ?").get(hash) as
    | { konto_id: string; zuletzt_abgerufen: string | null }
    | undefined;
  if (!z) return { ergebnis: "unbekannt" };
  const konto = findeKonto(z.konto_id);
  if (!darfKalender(konto)) return { ergebnis: "unbekannt" };

  const schluessel = [{ art: "kalender" as const, wert: hash }];
  if (istGedrosselt(schluessel, jetzt)) return { ergebnis: "gedrosselt" };
  registriereVersuch(schluessel, jetzt);

  // "Zuletzt abgerufen" nur alle paar Minuten schreiben, sonst wäre jeder Abruf ein Schreibzugriff mehr.
  if (!z.zuletzt_abgerufen || jetzt.getTime() - new Date(z.zuletzt_abgerufen).getTime() > 5 * 60_000) {
    db().prepare("UPDATE kalender_links SET zuletzt_abgerufen = ? WHERE token_hash = ?").run(jetzt.toISOString(), hash);
  }

  const name = inhalt === "meine" ? "Technikteam: meine Einsätze" : "Technikteam";
  return { ergebnis: "ok", ics: baueKalender({ name, ereignisse: ereignisseFuer(konto, inhalt, jetzt) }) };
}

/** Eine einzelne Veranstaltung als Datei zum Hinzufügen, für angemeldete Teammitglieder. Null, wenn es sie (dort) nicht gibt. */
export function terminDatei(akteur: Konto, anmeldungId: string): { ics: string; titel: string } | null {
  if (!darfKalender(akteur)) throw new FachFehler("Dafür fehlt die Berechtigung.");
  if (!/^[0-9a-f]{32}$/.test(anmeldungId) || !kalenderIds().has(anmeldungId)) return null;
  const a = findeNachId(anmeldungId);
  if (!a) return null;
  const ereignisse = ereignisseFuerAnmeldung(a, {
    basisUrl: appUrl(),
    besetzung: besetzungenFuerListe(akteur)(anmeldungId),
    erinnerung: false,
  });
  return { ics: baueKalender({ name: a.values.titel, ereignisse }), titel: a.values.titel };
}
