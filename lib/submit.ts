import type { FormValues } from "@/lib/registration";

export type SubmitResult = { ok: true } | { ok: false; message: string };

/**
 * Platzhalter. Speichert noch nichts.
 * Wird in Schritt 4 des Plans durch eine Server Action ersetzt, die validiert,
 * verschlüsselt, in SQLite schreibt und den privaten Link per E-Mail verschickt.
 */
export async function sendeAnmeldung(
  ...args: [values: FormValues, files: File[]]
): Promise<SubmitResult> {
  void args;
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { ok: true };
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
