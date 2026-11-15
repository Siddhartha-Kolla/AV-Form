import "server-only";
import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { FachFehler } from "./fehler.ts";

/*
  Passwörter werden mit scrypt gehasht (in Node eingebaut, keine zusätzliche Abhängigkeit).
  Gespeichertes Format: scrypt$N$r$p$salt$hash. Die Parameter stehen im Hash selbst,
  deshalb lassen sie sich später erhöhen, ohne dass alte Passwörter ungültig werden.
*/

const N = 2 ** 15;
const R = 8;
const P = 1;
const LAENGE = 64;
const MAXMEM = 128 * N * R * 2;

function ableiten(passwort: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(passwort.normalize("NFKC"), salt, LAENGE, { N: n, r, p, maxmem: Math.max(MAXMEM, 128 * n * r * 2) }, (fehler, schluessel) =>
      fehler ? reject(fehler) : resolve(schluessel),
    );
  });
}

export async function passwortHashen(passwort: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await ableiten(passwort, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function passwortPruefen(passwort: string, gespeichert: string): Promise<boolean> {
  const teile = gespeichert.split("$");
  if (teile.length !== 6 || teile[0] !== "scrypt") return false;
  const [n, r, p] = [Number(teile[1]), Number(teile[2]), Number(teile[3])];
  if (![n, r, p].every(Number.isInteger)) return false;
  const erwartet = Buffer.from(teile[5], "base64");
  const hash = await ableiten(passwort, Buffer.from(teile[4], "base64"), n, r, p);
  return hash.length === erwartet.length && timingSafeEqual(hash, erwartet);
}

let attrappe: Promise<string> | null = null;

/** Rechnet genauso lange wie eine echte Prüfung, damit unbekannte Benutzer nicht an der Antwortzeit auffallen. */
export async function attrappePruefen(passwort: string): Promise<void> {
  attrappe ??= passwortHashen(randomBytes(16).toString("hex"));
  await passwortPruefen(passwort, await attrappe);
}

/* Regeln ---------------------------------------------------------------- */

const HAEUFIG = ["passwort1234", "password1234", "123456789012", "qwertzuiop12", "technikteam1", "willkommen123"];

export const MIN_LAENGE = 12;
export const MAX_LAENGE = 128;

/** Liefert eine Fehlermeldung oder null, wenn das Passwort die Regeln erfüllt. */
export function passwortProblem(passwort: string, benutzername: string): string | null {
  if (passwort.length < MIN_LAENGE) return `Das Passwort braucht mindestens ${MIN_LAENGE} Zeichen.`;
  if (passwort.length > MAX_LAENGE) return `Das Passwort darf höchstens ${MAX_LAENGE} Zeichen lang sein.`;
  if (new Set(passwort).size < 5) return "Das Passwort ist zu einfach. Bitte mehr verschiedene Zeichen verwenden.";
  const klein = passwort.toLowerCase();
  if (benutzername.length >= 3 && klein.includes(benutzername.toLowerCase())) {
    return "Das Passwort darf den Benutzernamen nicht enthalten.";
  }
  if (HAEUFIG.some((h) => klein.includes(h))) return "Dieses Passwort ist zu bekannt. Bitte ein anderes wählen.";
  return null;
}

export function passwortPruefenOderFehler(passwort: string, benutzername: string): void {
  const problem = passwortProblem(passwort, benutzername);
  if (problem) throw new FachFehler(problem);
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // ohne leicht verwechselbare Zeichen

/** Lesbares Startpasswort im Format xxxx-xxxx-xxxx (rund 59 Bit Zufall). */
export function neuesStartpasswort(): string {
  const gruppe = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return [gruppe(), gruppe(), gruppe()].join("-");
}
