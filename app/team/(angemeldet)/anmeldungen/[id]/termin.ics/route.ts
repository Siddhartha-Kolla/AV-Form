import { dateiname } from "@/lib/kalender";
import { aktuelleSitzung } from "@/lib/server/auth/dal";
import { terminDatei } from "@/lib/server/kalender";

/** Eine angenommene Veranstaltung als .ics-Datei, zum Einmalig-Hinzufügen in den eigenen Kalender. */
export async function GET(_anfrage: Request, { params }: { params: Promise<{ id: string }> }) {
  const sitzung = await aktuelleSitzung();
  if (!sitzung) return new Response("Bitte zuerst anmelden.", { status: 401 });
  if (sitzung.konto.mussPasswortAendern) return new Response("Bitte zuerst ein eigenes Passwort wählen.", { status: 403 });

  const { id } = await params;
  let datei;
  try {
    datei = terminDatei(sitzung.konto, id);
  } catch {
    return new Response("Dafür fehlt die Berechtigung.", { status: 403 });
  }
  if (!datei) return new Response("Diese Veranstaltung ist nicht im Kalender.", { status: 404 });

  return new Response(datei.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dateiname(datei.titel)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
