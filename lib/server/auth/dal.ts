import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { darf, type Berechtigung } from "../../berechtigungen.ts";
import { proxyVertrauen } from "../config.ts";
import type { Kontext } from "./fehler.ts";
import type { Konto } from "./konten.ts";
import { pruefeSitzung } from "./sitzungen.ts";

/*
  Zugriffsschicht für Seiten und Server Actions.
  Jede Seite und jede Action fragt hier selbst nach, wer anfragt, und verlässt sich nie
  darauf, dass eine andere Stelle (Menü, Layout) schon geprüft hat.
*/

const PRODUKTIV = process.env.NODE_ENV === "production";
/** In Produktion mit __Host-Präfix: nur über HTTPS, nur für diese Domain, nur für den ganzen Pfad. */
export const COOKIE_NAME = PRODUKTIV ? "__Host-technik_session" : "technik_session";

export type Angemeldet = { konto: Konto; sitzungId: string; token: string };

/** IP-Adresse und Gerät der Anfrage. Die IP gibt es nur hinter einem vertrauten Proxy (TRUST_PROXY=1). */
export async function anfrageKontext(): Promise<Kontext> {
  const kopf = await headers();
  let ip: string | null = null;
  if (proxyVertrauen()) {
    const weitergeleitet = kopf.get("x-forwarded-for")?.split(",")[0]?.trim();
    ip = weitergeleitet || kopf.get("x-real-ip") || null;
  }
  const geraet = kopf.get("user-agent")?.slice(0, 160) ?? null;
  return { ip: ip ? ip.slice(0, 64) : null, geraet };
}

/** Die aktuelle Sitzung oder null. Wird pro Anfrage nur einmal berechnet. */
export const aktuelleSitzung = cache(async (): Promise<Angemeldet | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const treffer = pruefeSitzung(token);
  return treffer ? { konto: treffer.konto, sitzungId: treffer.sitzung.id, token } : null;
});

/**
 * Verlangt eine gültige Sitzung und leitet sonst zur Anmeldung. Mit "berechtigung" wird
 * zusätzlich die Rolle geprüft. Wer noch das Startpasswort hat, kommt nur zur Kontoseite.
 */
export async function verlangeSitzung(optionen: { berechtigung?: Berechtigung; passwortWechsel?: boolean } = {}) {
  const sitzung = await aktuelleSitzung();
  if (!sitzung) redirect("/team/login");
  if (sitzung.konto.mussPasswortAendern && !optionen.passwortWechsel) redirect("/team/konto");
  if (optionen.berechtigung && !darf(sitzung.konto.rolle, optionen.berechtigung)) {
    redirect("/team/keine-berechtigung");
  }
  return sitzung;
}

export async function setzeSitzungsCookie(token: string, laeuftAbAm: Date): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: PRODUKTIV,
    sameSite: "lax",
    path: "/",
    expires: laeuftAbAm,
  });
}

export async function loescheSitzungsCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
