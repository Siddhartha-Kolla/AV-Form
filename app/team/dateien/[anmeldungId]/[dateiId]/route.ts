import { anfrageKontext, aktuelleSitzung } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
import { ladeDateiFuerTeam } from "@/lib/server/team-anmeldungen";

const TYPEN: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  txt: "text/plain; charset=utf-8",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

/**
 * Liefert eine Datei an angemeldete Teammitglieder, immer mit "attachment", nie als Seite.
 * Die Vorschau holt dieselbe Datei per fetch und stellt sie selbst dar (mit "?vorschau=1",
 * damit das Protokoll das Ansehen vom Herunterladen unterscheiden kann).
 */
export async function GET(
  anfrage: Request,
  { params }: { params: Promise<{ anmeldungId: string; dateiId: string }> },
) {
  const sitzung = await aktuelleSitzung();
  if (!sitzung) return new Response("Bitte zuerst anmelden.", { status: 401 });
  if (sitzung.konto.mussPasswortAendern) return new Response("Bitte zuerst ein eigenes Passwort wählen.", { status: 403 });

  const { anmeldungId, dateiId } = await params;
  try {
    const datei = ladeDateiFuerTeam(
      sitzung.konto,
      anmeldungId,
      dateiId,
      await anfrageKontext(),
      new URL(anfrage.url).searchParams.get("vorschau") === "1" ? "vorschau" : "download",
    );
    if (!datei) return new Response("Datei nicht gefunden.", { status: 404 });

    const endung = datei.info.name.split(".").pop()?.toLowerCase() ?? "";
    const ascii = datei.info.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(new Uint8Array(datei.inhalt), {
      headers: {
        "Content-Type": TYPEN[endung] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(datei.info.name)}`,
        "Content-Length": String(datei.inhalt.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (fehler) {
    if (fehler instanceof FachFehler) return new Response(fehler.message, { status: 403 });
    console.error(fehler);
    return new Response("Das hat nicht geklappt.", { status: 500 });
  }
}
