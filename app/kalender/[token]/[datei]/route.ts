import { createHash } from "node:crypto";
import { connection } from "next/server";
import { kalenderFuerToken, type KalenderInhalt } from "@/lib/server/kalender";

const INHALTE: Record<string, KalenderInhalt> = { "alle.ics": "alle", "meine.ics": "meine" };

/**
 * Der Kalender zum Abonnieren. Es gibt keine Anmeldung: Das geheime Token in der Adresse ist der Zugang.
 * Ein falsches, widerrufenes oder gesperrtes Token ergibt immer dasselbe 404.
 */
export async function GET(anfrage: Request, { params }: { params: Promise<{ token: string; datei: string }> }) {
  await connection();
  const { token, datei } = await params;
  const inhalt = INHALTE[datei];
  if (!inhalt || token.length > 100) return new Response(null, { status: 404 });

  const abruf = kalenderFuerToken(token, inhalt);
  if (abruf.ergebnis === "unbekannt") return new Response(null, { status: 404 });
  if (abruf.ergebnis === "gedrosselt") return new Response("Zu viele Abrufe. Bitte später noch einmal.", { status: 429, headers: { "Retry-After": "900" } });

  const kopf = {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'inline; filename="technikteam.ics"',
    // Der Kalender enthält nichts für Suchmaschinen, und die Adresse darf nirgends als Verweis auftauchen.
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=300",
    ETag: `"${createHash("sha256").update(abruf.ics).digest("hex").slice(0, 32)}"`,
  };
  if (anfrage.headers.get("if-none-match") === kopf.ETag) return new Response(null, { status: 304, headers: kopf });
  return new Response(abruf.ics, { headers: kopf });
}
