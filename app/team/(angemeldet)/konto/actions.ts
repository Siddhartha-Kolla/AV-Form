"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { entferneKontoBild, speichereKontoBild } from "@/lib/server/auth/bilder";
import { FachFehler } from "@/lib/server/auth/fehler";
import { erzeugeKalenderLink, loescheKalenderLink } from "@/lib/server/kalender";
import { aendereEigenesPasswort, beendeEigeneAndereSitzungen } from "@/lib/server/auth/verwaltung";

export type KontoZustand = { ok?: boolean; fehler?: string; meldung?: string };

function text(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === "string" ? wert.slice(0, 200) : "";
}

export async function passwortAendernAktion(_vorher: KontoZustand, formData: FormData): Promise<KontoZustand> {
  const { konto, sitzungId } = await verlangeSitzung({ passwortWechsel: true });
  const neu = text(formData, "neu");
  if (neu !== text(formData, "wiederholung")) return { ok: false, fehler: "Die beiden neuen Passwörter sind nicht gleich." };

  try {
    await aendereEigenesPasswort(konto, sitzungId, { aktuell: text(formData, "aktuell"), neu }, await anfrageKontext());
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { ok: false, fehler: fehler.message };
    console.error(fehler);
    return { ok: false, fehler: "Das hat nicht geklappt. Bitte noch einmal probieren." };
  }
  revalidatePath("/team", "layout");
  if (konto.mussPasswortAendern) redirect("/team");
  return { ok: true, meldung: "Passwort geändert. Andere Sitzungen wurden beendet." };
}

export async function andereSitzungenBeendenAktion(): Promise<KontoZustand> {
  const { konto, sitzungId } = await verlangeSitzung({ passwortWechsel: true });
  const anzahl = beendeEigeneAndereSitzungen(konto, sitzungId, await anfrageKontext());
  revalidatePath("/team/konto");
  return { ok: true, meldung: anzahl === 0 ? "Es gab keine anderen Sitzungen." : `${anzahl} andere Sitzung(en) beendet.` };
}

/** Das Profilbild kommt fertig zugeschnitten aus dem Browser. Der Server prüft Format und Größe trotzdem selbst. */
export async function bildSpeichernAktion(formData: FormData): Promise<KontoZustand> {
  const { konto } = await verlangeSitzung({ passwortWechsel: true });
  const datei = formData.get("bild");
  if (!(datei instanceof File)) return { ok: false, fehler: "Es wurde kein Bild gesendet." };
  try {
    speichereKontoBild(konto, Buffer.from(await datei.arrayBuffer()), await anfrageKontext());
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { ok: false, fehler: fehler.message };
    console.error(fehler);
    return { ok: false, fehler: "Das hat nicht geklappt. Bitte noch einmal probieren." };
  }
  revalidatePath("/team", "layout");
  return { ok: true, meldung: "Profilbild gespeichert." };
}

export async function bildEntfernenAktion(): Promise<KontoZustand> {
  const { konto } = await verlangeSitzung({ passwortWechsel: true });
  entferneKontoBild(konto, await anfrageKontext());
  revalidatePath("/team", "layout");
  return { ok: true, meldung: "Profilbild entfernt." };
}

/** Erzeugt den Kalender-Link, oder einen neuen. Ein alter Link wird dadurch ungültig. */
export async function kalenderLinkErzeugenAktion(): Promise<KontoZustand> {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.lesen" });
  try {
    erzeugeKalenderLink(konto, await anfrageKontext());
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { ok: false, fehler: fehler.message };
    console.error(fehler);
    return { ok: false, fehler: "Das hat nicht geklappt. Bitte noch einmal probieren." };
  }
  revalidatePath("/team/konto");
  return { ok: true };
}

export async function kalenderLinkLoeschenAktion(): Promise<KontoZustand> {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.lesen" });
  loescheKalenderLink(konto, await anfrageKontext());
  revalidatePath("/team/konto");
  return { ok: true };
}
