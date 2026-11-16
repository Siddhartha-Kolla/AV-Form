import { aktuelleSitzung } from "@/lib/server/auth/dal";
import { ladeKontoBild } from "@/lib/server/auth/bilder";

/**
 * Das Profilbild eines Teammitglieds. Nur mit gültiger Sitzung. Die Adresse enthält die Version des Bildes
 * (?v=...), deshalb darf der Browser es lange behalten: Ein neues Bild hat eine neue Adresse.
 */
export async function GET(anfrage: Request, { params }: { params: Promise<{ id: string }> }) {
  const sitzung = await aktuelleSitzung();
  if (!sitzung) return new Response(null, { status: 401 });

  const { id } = await params;
  const bild = id.length <= 64 ? ladeKontoBild(id) : null;
  if (!bild) return new Response(null, { status: 404 });

  const kopf = {
    "Content-Type": bild.typ,
    // Nur anzeigen: Das Bild darf nie als etwas anderes gedeutet werden oder Inhalte nachladen.
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: `"${bild.version}"`,
  };
  if (anfrage.headers.get("if-none-match") === kopf.ETag) return new Response(null, { status: 304, headers: kopf });
  return new Response(new Uint8Array(bild.daten), { headers: kopf });
}
