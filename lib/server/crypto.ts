import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/*
  Verschlüsselung im Anwendungscode.

  Aus jedem Hauptschlüssel werden zwei getrennte Schlüssel abgeleitet: einer für
  AES-256-GCM, einer für den E-Mail-Hash. Gespeichertes Format eines
  verschlüsselten Werts: [Version 1 Byte][Schlüssel-ID 1 Byte][IV 12 Byte][Chiffretext][Tag 16 Byte].
  Die "aad" bindet einen Wert an seinen Zweck und seine ID. Ein aus einer anderen
  Zeile kopierter Wert lässt sich damit nicht entschlüsseln.
*/

type SchluesselPaar = { id: number; enc: Buffer; mac: Buffer };

let ring: SchluesselPaar[] | null = null;

function ableiten(master: Buffer, info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, "technik-form", info, 32));
}

function schluesselRing(): SchluesselPaar[] {
  if (ring) return ring;
  const roh = process.env.APP_ENCRYPTION_KEYS;
  if (!roh) {
    throw new Error("APP_ENCRYPTION_KEYS fehlt. Mit `npm run keygen` einen Schlüssel erzeugen.");
  }
  const paare = roh.split(",").map((teil) => {
    const [idText, b64] = teil.trim().split(":");
    const id = Number(idText);
    const master = Buffer.from(b64 ?? "", "base64");
    if (!Number.isInteger(id) || id < 1 || id > 255 || master.length !== 32) {
      throw new Error("APP_ENCRYPTION_KEYS hat das falsche Format. Erwartet: <id>:<32 Byte als base64>.");
    }
    return { id, enc: ableiten(master, "enc"), mac: ableiten(master, "email-hmac") };
  });
  if (new Set(paare.map((p) => p.id)).size !== paare.length) {
    throw new Error("APP_ENCRYPTION_KEYS enthält eine Schlüssel-ID doppelt.");
  }
  ring = paare;
  return paare;
}

/** Nur für Tests: erzwingt, dass die Schlüssel neu aus der Umgebung gelesen werden. */
export function schluesselNeuLaden(): void {
  ring = null;
}

export function verschluesseln(klartext: Buffer | string, aad: string): Buffer {
  const schluessel = schluesselRing()[0];
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", schluessel.enc, iv);
  cipher.setAAD(Buffer.from(aad));
  const chiffre = Buffer.concat([cipher.update(klartext), cipher.final()]);
  return Buffer.concat([Buffer.from([1, schluessel.id]), iv, chiffre, cipher.getAuthTag()]);
}

export function entschluesseln(blob: Buffer, aad: string): Buffer {
  if (blob.length < 2 + 12 + 16 || blob[0] !== 1) {
    throw new Error("Unbekanntes oder beschädigtes Format.");
  }
  const schluessel = schluesselRing().find((s) => s.id === blob[1]);
  if (!schluessel) throw new Error(`Schlüssel ${blob[1]} ist nicht mehr konfiguriert.`);
  const iv = blob.subarray(2, 14);
  const tag = blob.subarray(blob.length - 16);
  const chiffre = blob.subarray(14, blob.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", schluessel.enc, iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(chiffre), decipher.final()]);
}

function normalisiert(email: string): string {
  return email.trim().toLowerCase();
}

/** Hash mit dem aktuellen Schlüssel, für neue Zeilen. */
export function emailHash(email: string): string {
  return createHmac("sha256", schluesselRing()[0].mac).update(normalisiert(email)).digest("hex");
}

/** Hashes mit allen Schlüsseln, für die Suche (Zeilen können mit einem älteren Schlüssel stehen). */
export function emailHashes(email: string): string[] {
  return schluesselRing().map((s) => createHmac("sha256", s.mac).update(normalisiert(email)).digest("hex"));
}

/* Zugangslinks ---------------------------------------------------------- */

const TOKEN_FORM = /^[A-Za-z0-9_-]{43}$/;

/** 256 Bit Zufall. Wird nur per E-Mail verschickt, in der Datenbank steht nur der Hash. */
export function neuesToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenGueltigeForm(token: string): boolean {
  return TOKEN_FORM.test(token);
}

/** SHA-256 reicht, weil das Token selbst schon 256 Bit Zufall ist. */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function neueId(): string {
  return randomBytes(16).toString("hex");
}
