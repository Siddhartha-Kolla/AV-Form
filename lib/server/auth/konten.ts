import "server-only";
import { z } from "zod";
import { istRolle, ROLLEN, type RolleId } from "../../berechtigungen.ts";
import { entschluesseln, neueId, schluesselHash, verschluesseln } from "../crypto.ts";
import { db } from "../db.ts";
import { FachFehler } from "./fehler.ts";
import { passwortHashen, passwortPruefenOderFehler } from "./passwort.ts";

/*
  Konten und ihre Anmeldeidentitäten.

  Ein Konto ist eine Person im Team. Wie sie sich anmeldet, steht in "identitaeten":
  eine Zeile pro Anmeldemethode (Anbieter plus Kennung bei diesem Anbieter, zum Beispiel
  "passwort" + Benutzername oder später "oidc-schule" + Subject-Claim). Weitere Methoden
  lassen sich ergänzen, ohne dass sich an den Konten etwas ändert.

  Benutzername, Anzeigename und E-Mail stehen verschlüsselt in "daten". Für die Suche
  gibt es nur einen Hash des Benutzernamens.
*/

export type KontoStatus = "aktiv" | "gesperrt";

export type Konto = {
  id: string;
  benutzername: string;
  anzeigename: string;
  email: string;
  rolle: RolleId;
  status: KontoStatus;
  mussPasswortAendern: boolean;
  erstelltAm: string;
  geaendertAm: string;
  letzterLogin: string | null;
};

type Zeile = {
  id: string;
  daten: Buffer;
  rolle: string;
  status: KontoStatus;
  muss_passwort_aendern: number;
  erstellt_am: string;
  geaendert_am: string;
  letzter_login: string | null;
};

const SPALTEN = "id, daten, rolle, status, muss_passwort_aendern, erstellt_am, geaendert_am, letzter_login";

export function normalisiereBenutzername(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

function zuKonto(z: Zeile): Konto {
  const d = JSON.parse(entschluesseln(z.daten, `konto:${z.id}`).toString("utf8")) as {
    benutzername: string;
    anzeigename: string;
    email: string;
  };
  return {
    id: z.id,
    benutzername: d.benutzername,
    anzeigename: d.anzeigename,
    email: d.email,
    rolle: istRolle(z.rolle) ? z.rolle : "mitglied",
    status: z.status,
    mussPasswortAendern: z.muss_passwort_aendern === 1,
    erstelltAm: z.erstellt_am,
    geaendertAm: z.geaendert_am,
    letzterLogin: z.letzter_login,
  };
}

function verpacken(id: string, d: { benutzername: string; anzeigename: string; email: string }): Buffer {
  return verschluesseln(JSON.stringify(d), `konto:${id}`);
}

/* Eingaben prüfen -------------------------------------------------------- */

const benutzernameSchema = z
  .string()
  .transform(normalisiereBenutzername)
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9._-]{3,32}$/, "Der Benutzername darf 3 bis 32 Zeichen lang sein und nur Kleinbuchstaben, Ziffern, Punkt, Unterstrich und Bindestrich enthalten."),
  );
const anzeigenameSchema = z
  .string()
  .trim()
  .min(2, "Bitte einen Namen mit mindestens 2 Zeichen angeben.")
  .max(80, "Der Name darf höchstens 80 Zeichen lang sein.");
const emailSchema = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || z.email().safeParse(v).success, "Diese E-Mail-Adresse sieht nicht vollständig aus.");

function pruefe<T>(schema: z.ZodType<T>, wert: unknown): T {
  const ergebnis = schema.safeParse(wert);
  if (!ergebnis.success) throw new FachFehler(ergebnis.error.issues[0].message);
  return ergebnis.data;
}

/* Lesen ------------------------------------------------------------------ */

export function findeKonto(id: string): Konto | null {
  const z = db().prepare(`SELECT ${SPALTEN} FROM konten WHERE id = ?`).get(id) as Zeile | undefined;
  return z ? zuKonto(z) : null;
}

export function findeKontoNachBenutzername(benutzername: string): Konto | null {
  const z = db()
    .prepare(`SELECT ${SPALTEN} FROM konten WHERE benutzername_hash = ?`)
    .get(schluesselHash("benutzername", normalisiereBenutzername(benutzername))) as Zeile | undefined;
  return z ? zuKonto(z) : null;
}

export function listeKonten(): Konto[] {
  const zeilen = db().prepare(`SELECT ${SPALTEN} FROM konten`).all() as Zeile[];
  return zeilen.map(zuKonto).sort((a, b) => a.anzeigename.localeCompare(b.anzeigename, "de"));
}

export function superuserVorhanden(): boolean {
  return !!db().prepare("SELECT 1 FROM konten WHERE rolle = 'superuser'").get();
}

/* Identitäten ------------------------------------------------------------ */

export function subjektHash(subjekt: string): string {
  return schluesselHash("subjekt", subjekt);
}

/** Findet das Konto zu einer Identität bei einem Anbieter. */
export function findeKontoNachIdentitaet(anbieter: string, subjekt: string): Konto | null {
  const z = db()
    .prepare(
      `SELECT ${SPALTEN.split(", ").map((s) => `k.${s}`).join(", ")} FROM identitaeten i
       JOIN konten k ON k.id = i.konto_id WHERE i.anbieter = ? AND i.subjekt_hash = ?`,
    )
    .get(anbieter, subjektHash(subjekt)) as Zeile | undefined;
  return z ? zuKonto(z) : null;
}

/** Das gespeicherte Geheimnis (zum Beispiel ein Passwort-Hash) einer Identität. */
export function holeGeheimnis(anbieter: string, subjekt: string): string | null {
  const z = db()
    .prepare("SELECT id, geheimnis FROM identitaeten WHERE anbieter = ? AND subjekt_hash = ?")
    .get(anbieter, subjektHash(subjekt)) as { id: string; geheimnis: Buffer | null } | undefined;
  if (!z?.geheimnis) return null;
  return entschluesseln(z.geheimnis, `identitaet:${z.id}`).toString("utf8");
}

/** Verknüpft ein Konto mit einer Anmeldemethode. Ein Konto kann mehrere haben. */
export function verknuepfeIdentitaet(kontoId: string, anbieter: string, subjekt: string, geheimnis?: string): void {
  const id = neueId();
  try {
    db()
      .prepare(
        "INSERT INTO identitaeten (id, konto_id, anbieter, subjekt_hash, geheimnis, erstellt_am) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        kontoId,
        anbieter,
        subjektHash(subjekt),
        geheimnis ? verschluesseln(geheimnis, `identitaet:${id}`) : null,
        new Date().toISOString(),
      );
  } catch (fehler) {
    if (istEindeutigkeitsfehler(fehler)) throw new FachFehler("Diese Anmeldemethode ist schon einem Konto zugeordnet.");
    throw fehler;
  }
}

export function loeseIdentitaet(kontoId: string, anbieter: string): void {
  db().prepare("DELETE FROM identitaeten WHERE konto_id = ? AND anbieter = ?").run(kontoId, anbieter);
}

export function identitaetenVon(kontoId: string): string[] {
  const zeilen = db().prepare("SELECT anbieter FROM identitaeten WHERE konto_id = ?").all(kontoId) as {
    anbieter: string;
  }[];
  return zeilen.map((z) => z.anbieter);
}

function istEindeutigkeitsfehler(fehler: unknown): boolean {
  return typeof fehler === "object" && fehler !== null && (fehler as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

/* Anlegen und ändern ------------------------------------------------------ */

export async function erstelleKonto(eingabe: {
  benutzername: string;
  anzeigename: string;
  email?: string;
  rolle: RolleId;
  passwort: string;
  mussPasswortAendern?: boolean;
}): Promise<Konto> {
  const benutzername = pruefe(benutzernameSchema, eingabe.benutzername);
  const anzeigename = pruefe(anzeigenameSchema, eingabe.anzeigename);
  const email = pruefe(emailSchema, eingabe.email ?? "");
  if (!istRolle(eingabe.rolle)) throw new FachFehler("Diese Rolle gibt es nicht.");
  passwortPruefenOderFehler(eingabe.passwort, benutzername);
  const hash = await passwortHashen(eingabe.passwort);

  const id = neueId();
  const jetzt = new Date().toISOString();
  try {
    db().transaction(() => {
      db()
        .prepare(
          `INSERT INTO konten (id, benutzername_hash, daten, rolle, status, muss_passwort_aendern, erstellt_am, geaendert_am)
           VALUES (?, ?, ?, ?, 'aktiv', ?, ?, ?)`,
        )
        .run(
          id,
          schluesselHash("benutzername", benutzername),
          verpacken(id, { benutzername, anzeigename, email }),
          eingabe.rolle,
          eingabe.mussPasswortAendern === false ? 0 : 1,
          jetzt,
          jetzt,
        );
      verknuepfeIdentitaet(id, "passwort", benutzername, hash);
    })();
  } catch (fehler) {
    if (istEindeutigkeitsfehler(fehler)) {
      const rolleBelegt = eingabe.rolle === "superuser" && superuserVorhanden();
      throw new FachFehler(
        rolleBelegt ? "Es gibt schon einen Superuser." : "Dieser Benutzername ist schon vergeben.",
      );
    }
    throw fehler;
  }
  return findeKonto(id)!;
}

function ladeVeraenderbar(id: string): Konto {
  const konto = findeKonto(id);
  if (!konto) throw new FachFehler("Dieses Mitglied gibt es nicht mehr.");
  return konto;
}

function schuetzeSuperuser(konto: Konto): void {
  if (konto.rolle === "superuser") {
    throw new FachFehler("Der Superuser lässt sich hier nicht ändern. Dafür gibt es die Kommandozeile auf dem Server.");
  }
}

export function aendereDaten(id: string, eingabe: { anzeigename: string; email?: string }): Konto {
  const konto = ladeVeraenderbar(id);
  const anzeigename = pruefe(anzeigenameSchema, eingabe.anzeigename);
  const email = pruefe(emailSchema, eingabe.email ?? "");
  db()
    .prepare("UPDATE konten SET daten = ?, geaendert_am = ? WHERE id = ?")
    .run(verpacken(id, { benutzername: konto.benutzername, anzeigename, email }), new Date().toISOString(), id);
  return findeKonto(id)!;
}

export function aendereRolle(id: string, rolle: string): Konto {
  const konto = ladeVeraenderbar(id);
  schuetzeSuperuser(konto);
  if (!istRolle(rolle) || rolle === "superuser") throw new FachFehler("Diese Rolle lässt sich nicht vergeben.");
  db().prepare("UPDATE konten SET rolle = ?, geaendert_am = ? WHERE id = ?").run(rolle, new Date().toISOString(), id);
  return findeKonto(id)!;
}

export function setzeStatus(id: string, status: KontoStatus): Konto {
  const konto = ladeVeraenderbar(id);
  schuetzeSuperuser(konto);
  db().prepare("UPDATE konten SET status = ?, geaendert_am = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  return findeKonto(id)!;
}

export function loescheKonto(id: string): Konto {
  const konto = ladeVeraenderbar(id);
  schuetzeSuperuser(konto);
  db().prepare("DELETE FROM konten WHERE id = ?").run(id);
  return konto;
}

/** Setzt das Passwort. Mit mussAendern=true muss die Person beim nächsten Login ein eigenes wählen. */
export async function setzePasswort(id: string, passwort: string, mussAendern: boolean): Promise<void> {
  const konto = ladeVeraenderbar(id);
  passwortPruefenOderFehler(passwort, konto.benutzername);
  const hash = await passwortHashen(passwort);
  db().transaction(() => {
    const vorhanden = db()
      .prepare("SELECT id FROM identitaeten WHERE konto_id = ? AND anbieter = 'passwort'")
      .get(id) as { id: string } | undefined;
    if (vorhanden) {
      db()
        .prepare("UPDATE identitaeten SET geheimnis = ? WHERE id = ?")
        .run(verschluesseln(hash, `identitaet:${vorhanden.id}`), vorhanden.id);
    } else {
      verknuepfeIdentitaet(id, "passwort", konto.benutzername, hash);
    }
    db()
      .prepare("UPDATE konten SET muss_passwort_aendern = ?, geaendert_am = ? WHERE id = ?")
      .run(mussAendern ? 1 : 0, new Date().toISOString(), id);
  })();
}

export function markiereLogin(id: string): void {
  db().prepare("UPDATE konten SET letzter_login = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export const ROLLEN_NAMEN = Object.fromEntries(
  (Object.keys(ROLLEN) as RolleId[]).map((r) => [r, ROLLEN[r].name]),
) as Record<RolleId, string>;
