import "server-only";

/*
  Gemeinsame Hilfen für die Routen, die ein Formular mit Dateien annehmen (Anmeldung, Änderung durch die
  Lehrkraft). Server Actions sind bei Dateien auf 1 MB begrenzt, deshalb laufen diese Formulare als
  normale POST-Anfrage mit multipart-Inhalt.
*/

/** Zehn Dateien mit je 20 MB plus Reserve für die Angaben. */
export const MAX_ANFRAGE = 230 * 1024 * 1024;

export function antwort(daten: object, status = 200): Response {
  return Response.json(daten, { status, headers: { "Cache-Control": "no-store" } });
}

/** Nur von dieser Seite aus. SameSite schützt Cookies, die Herkunftsprüfung ist hier ein zweiter Riegel. */
export function aufDieserSeite(anfrage: Request): boolean {
  const herkunft = anfrage.headers.get("origin");
  return !herkunft || new URL(herkunft).host === new URL(anfrage.url).host;
}

export type GelesenesFormular =
  | { ok: false; antwort: Response }
  | {
      ok: true;
      formular: FormData;
      values: unknown;
      entferne: string[];
      dateien: { name: string; inhalt: Buffer }[];
    };

export async function liesFormular(anfrage: Request): Promise<GelesenesFormular> {
  if (!aufDieserSeite(anfrage)) {
    return { ok: false, antwort: antwort({ ok: false, meldung: "Die Anfrage kommt nicht von dieser Seite." }, 403) };
  }
  // Ohne Längenangabe lässt sich die Größe nicht vorab begrenzen, deshalb wird sie verlangt.
  const laenge = Number(anfrage.headers.get("content-length"));
  if (!Number.isFinite(laenge) || laenge <= 0) {
    return { ok: false, antwort: antwort({ ok: false, meldung: "Die Anfrage ließ sich nicht lesen." }, 411) };
  }
  if (laenge > MAX_ANFRAGE) {
    return { ok: false, antwort: antwort({ ok: false, meldung: "Die Dateien sind zusammen zu groß." }, 413) };
  }

  let formular: FormData;
  try {
    formular = await anfrage.formData();
  } catch {
    return { ok: false, antwort: antwort({ ok: false, meldung: "Die Anfrage ließ sich nicht lesen." }, 400) };
  }

  let values: unknown;
  let entferne: unknown;
  try {
    values = JSON.parse(String(formular.get("daten") ?? ""));
    entferne = JSON.parse(String(formular.get("entfernen") ?? "[]"));
  } catch {
    return { ok: false, antwort: antwort({ ok: false, meldung: "Die Angaben haben ein ungültiges Format." }, 400) };
  }
  if (!Array.isArray(entferne) || entferne.some((e) => typeof e !== "string")) {
    return { ok: false, antwort: antwort({ ok: false, meldung: "Die Angaben haben ein ungültiges Format." }, 400) };
  }

  const dateien: { name: string; inhalt: Buffer }[] = [];
  for (const teil of formular.getAll("dateien")) {
    if (typeof teil === "string") continue;
    dateien.push({ name: teil.name, inhalt: Buffer.from(await teil.arrayBuffer()) });
  }
  return { ok: true, formular, values, entferne: entferne as string[], dateien };
}
