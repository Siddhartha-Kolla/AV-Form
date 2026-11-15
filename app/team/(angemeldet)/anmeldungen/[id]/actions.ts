"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
import { loescheAnmeldungFuerTeam } from "@/lib/server/team-anmeldungen";

export type LoeschZustand = { fehler?: string };

export async function anmeldungLoeschenAktion(_vorher: LoeschZustand, formData: FormData): Promise<LoeschZustand> {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.loeschen" });
  const id = formData.get("id");
  try {
    loescheAnmeldungFuerTeam(konto, typeof id === "string" ? id.slice(0, 64) : "", await anfrageKontext());
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { fehler: fehler.message };
    console.error(fehler);
    return { fehler: "Das hat nicht geklappt. Bitte noch einmal probieren." };
  }
  revalidatePath("/team");
  redirect("/team");
}
