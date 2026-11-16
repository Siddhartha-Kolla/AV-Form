/*
  Profilbilder: die Regeln, die Browser und Server gemeinsam brauchen. Reine Funktionen ohne Datenbank.

  Der Browser schneidet das Bild quadratisch zu und verkleinert es (siehe profilbild.tsx). Der Server
  verlässt sich trotzdem nicht darauf: Er erkennt das Format am Inhalt, nicht am Dateinamen, und nimmt nur
  Formate an, die ein Browser als Bild darstellt, ohne Skripte auszuführen. SVG gehört bewusst nicht dazu.
*/

export const BILD_TYPEN = ["image/jpeg", "image/png", "image/webp"] as const;
export type BildTyp = (typeof BILD_TYPEN)[number];

/** Kantenlänge des fertigen Bildes in Pixeln. Reicht für 96 Pixel Anzeige auf scharfen Bildschirmen. */
export const BILD_KANTE = 256;
export const MAX_BILD_BYTES = 150_000;

export function istBildTyp(wert: unknown): wert is BildTyp {
  return typeof wert === "string" && (BILD_TYPEN as readonly string[]).includes(wert);
}

/** Erkennt das Format an den ersten Bytes. */
export function erkenneBildTyp(bytes: Uint8Array): BildTyp | null {
  const gleich = (ab: number, muster: number[]) => muster.every((b, i) => bytes[ab + i] === b);
  if (bytes.length < 12) return null;
  if (gleich(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (gleich(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: "RIFF", vier Bytes Länge, dann "WEBP".
  if (gleich(0, [0x52, 0x49, 0x46, 0x46]) && gleich(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  return null;
}

export function pruefeBild(bytes: Uint8Array): { ok: true; typ: BildTyp } | { ok: false; meldung: string } {
  if (bytes.length === 0) return { ok: false, meldung: "Es wurde kein Bild gesendet." };
  if (bytes.length > MAX_BILD_BYTES) return { ok: false, meldung: "Das Bild ist zu groß. Bitte wähle ein anderes." };
  const typ = erkenneBildTyp(bytes);
  if (!typ) return { ok: false, meldung: "Das ist kein JPEG-, PNG- oder WebP-Bild." };
  return { ok: true, typ };
}
