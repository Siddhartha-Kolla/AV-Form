"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { FachFehler } from "@/lib/server/auth/fehler";
import { istStatus, type Entscheidung, type StatusId } from "@/lib/entscheidung";
import { benachrichtigeLehrkraft } from "@/lib/server/benachrichtigung";
import type { MailErgebnis } from "@/lib/server/mail";
import { entscheideFuerTeam, loescheAnmeldungFuerTeam } from "@/lib/server/team-anmeldungen";

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

/** Bei Erfolg steht dabei, ob die Mail an die Lehrkraft rausging. */
export type EntscheidungsAntwort = { ok: true; mail: MailErgebnis } | { ok: false; meldung: string };

/** Annehmen, Rückfrage oder Ablehnen. Die Eingaben kommen vom Browser und werden im Server geprüft. */
export async function anmeldungEntscheidenAktion(eingabe: {
  id: string;
  status: Entscheidung;
  erwarteterStatus: StatusId;
  nachricht: string;
}): Promise<EntscheidungsAntwort> {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.entscheiden" });
  const id = typeof eingabe?.id === "string" ? eingabe.id.slice(0, 64) : "";
  const nachricht = typeof eingabe?.nachricht === "string" ? eingabe.nachricht.slice(0, 2000) : "";
  if (!istStatus(eingabe?.erwarteterStatus)) return { ok: false, meldung: "Das hat nicht geklappt. Bitte lade die Seite neu." };
  let mail: MailErgebnis;
  try {
    const kontext = await anfrageKontext();
    const ergebnis = entscheideFuerTeam(
      konto,
      id,
      { status: eingabe.status, nachricht, erwarteterStatus: eingabe.erwarteterStatus },
      kontext,
    );
    if (!ergebnis.ok) return ergebnis;
    // Erst nach dem Speichern. Geht die Mail schief, gilt die Entscheidung trotzdem.
    mail = await benachrichtigeLehrkraft(
      id,
      { status: eingabe.status, nachricht, akteur: { id: konto.id, name: konto.anzeigename } },
      kontext,
    );
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { ok: false, meldung: fehler.message };
    console.error(fehler);
    return { ok: false, meldung: "Das hat nicht geklappt. Bitte noch einmal probieren." };
  }
  revalidatePath("/team");
  revalidatePath(`/team/anmeldungen/${id}`);
  return { ok: true, mail };
}
