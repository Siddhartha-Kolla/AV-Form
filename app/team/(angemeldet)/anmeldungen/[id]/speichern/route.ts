import { anfrageKontext, aktuelleSitzung } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
import { bearbeiteFuerTeam } from "@/lib/server/team-anmeldungen";
import { revalidatePath } from "next/cache";

/** Dateien und Formular zusammen dürfen nicht größer sein als zehn Dateien mit je 20 MB plus Reserve. */
const MAX_ANFRAGE = 230 * 1024 * 1024;

function antwort(daten: object, status = 200) {
  return Response.json(daten, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Speichert die Bearbeitung einer Anmeldung: geänderte Angaben, entfernte und neue Dateien in einer Anfrage.
 * Als Formular mit Dateien gesendet (multipart), weil Server Actions bei Dateien auf 1 MB begrenzt sind.
 */
export async function POST(anfrage: Request, { params }: { params: Promise<{ id: string }> }) {
  // Nur von dieser Seite aus. SameSite=Lax schützt schon, die Herkunftsprüfung ist ein zweiter Riegel.
  const herkunft = anfrage.headers.get("origin");
  if (herkunft && new URL(herkunft).host !== new URL(anfrage.url).host) {
    return antwort({ ok: false, meldung: "Die Anfrage kommt nicht von dieser Seite." }, 403);
  }
  const sitzung = await aktuelleSitzung();
  if (!sitzung) return antwort({ ok: false, meldung: "Deine Sitzung ist abgelaufen. Bitte melde dich neu an." }, 401);
  if (sitzung.konto.mussPasswortAendern) return antwort({ ok: false, meldung: "Bitte zuerst ein eigenes Passwort wählen." }, 403);

  const laenge = Number(anfrage.headers.get("content-length") ?? 0);
  if (laenge > MAX_ANFRAGE) return antwort({ ok: false, meldung: "Die Dateien sind zusammen zu groß." }, 413);

  const { id } = await params;
  let formular: FormData;
  try {
    formular = await anfrage.formData();
  } catch {
    return antwort({ ok: false, meldung: "Die Anfrage ließ sich nicht lesen." }, 400);
  }

  let values: unknown;
  let entferne: unknown;
  try {
    values = JSON.parse(String(formular.get("daten") ?? ""));
    entferne = JSON.parse(String(formular.get("entfernen") ?? "[]"));
  } catch {
    return antwort({ ok: false, meldung: "Die Angaben haben ein ungültiges Format." }, 400);
  }
  if (!Array.isArray(entferne) || entferne.some((e) => typeof e !== "string")) {
    return antwort({ ok: false, meldung: "Die Angaben haben ein ungültiges Format." }, 400);
  }

  const neueDateien: { name: string; inhalt: Buffer }[] = [];
  for (const teil of formular.getAll("dateien")) {
    if (typeof teil === "string") continue;
    neueDateien.push({ name: teil.name, inhalt: Buffer.from(await teil.arrayBuffer()) });
  }

  try {
    const ergebnis = bearbeiteFuerTeam(
      sitzung.konto,
      id,
      {
        values,
        revision: Number(formular.get("revision")),
        notiz: String(formular.get("notiz") ?? ""),
        entferneDateiIds: entferne as string[],
        neueDateien,
      },
      await anfrageKontext(),
    );
    if (ergebnis.ok) {
      revalidatePath("/team");
      revalidatePath(`/team/anmeldungen/${id}`);
    }
    return antwort(ergebnis, ergebnis.ok ? 200 : 422);
  } catch (fehler) {
    if (fehler instanceof FachFehler) return antwort({ ok: false, meldung: fehler.message }, 403);
    console.error(fehler);
    return antwort({ ok: false, meldung: "Das Speichern hat nicht geklappt. Bitte noch einmal probieren." }, 500);
  }
}
