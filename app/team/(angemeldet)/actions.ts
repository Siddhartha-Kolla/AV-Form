"use server";

import { redirect } from "next/navigation";
import { anfrageKontext, aktuelleSitzung, loescheSitzungsCookie } from "@/lib/server/auth/dal";
import { abmelden } from "@/lib/server/auth/verwaltung";

export async function abmeldenAktion(): Promise<void> {
  const sitzung = await aktuelleSitzung();
  if (sitzung) abmelden(sitzung.token, sitzung.konto, await anfrageKontext());
  await loescheSitzungsCookie();
  redirect("/team/login");
}
