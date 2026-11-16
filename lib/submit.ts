import type { FormValues } from "@/lib/registration";

export type MailStand = "gesendet" | "nicht_konfiguriert" | "fehlgeschlagen";

export type SubmitResult =
  | { ok: true; mail: MailStand }
  | { ok: false; message: string | null; fehler: Record<string, string>; dateiFehler: string[] };

/**
 * Schickt die Anmeldung an den Server. Als normale Anfrage mit Dateien, weil Server Actions bei Dateien auf 1 MB
 * begrenzt sind. "gestartet" und "webseite" sind für den Schutz vor Programmen gedacht, siehe app/anmeldung/senden.
 */
export async function sendeAnmeldung(
  values: FormValues,
  files: File[],
  schutz: { gestartet: number; webseite: string },
): Promise<SubmitResult> {
  const daten = new FormData();
  daten.set("daten", JSON.stringify(values));
  daten.set("gestartet", String(schutz.gestartet));
  daten.set("webseite", schutz.webseite);
  for (const f of files) daten.append("dateien", f);

  try {
    const antwort = await fetch("/anmeldung/senden", { method: "POST", body: daten });
    const ergebnis = (await antwort.json()) as {
      ok: boolean;
      mail?: MailStand;
      meldung?: string;
      fehler?: Record<string, string>;
      dateiFehler?: string[];
    };
    if (ergebnis.ok) return { ok: true, mail: ergebnis.mail ?? "gesendet" };
    return {
      ok: false,
      message: ergebnis.meldung ?? null,
      fehler: ergebnis.fehler ?? {},
      dateiFehler: ergebnis.dateiFehler ?? [],
    };
  } catch {
    return {
      ok: false,
      message: "Keine Verbindung zum Server. Ihre Angaben sind noch da. Bitte versuchen Sie es noch einmal.",
      fehler: {},
      dateiFehler: [],
    };
  }
}

export function datumLang(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
