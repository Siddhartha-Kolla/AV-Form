"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
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
