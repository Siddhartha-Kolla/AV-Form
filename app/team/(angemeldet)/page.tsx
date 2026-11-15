import { redirect } from "next/navigation";
import { darf } from "@/lib/berechtigungen";
import { verlangeSitzung } from "@/lib/server/auth/dal";

/** Einstieg in den Teambereich. Die Übersicht der Anmeldungen kommt im nächsten Schritt hierher. */
export default async function TeamStart() {
  const { konto } = await verlangeSitzung();
  redirect(darf(konto.rolle, "team.verwalten") ? "/team/mitglieder" : "/team/konto");
}
