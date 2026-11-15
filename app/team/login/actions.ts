"use server";

import { redirect } from "next/navigation";
import { anmelden } from "@/lib/server/auth/anmelden";
import { anfrageKontext, setzeSitzungsCookie } from "@/lib/server/auth/dal";

export type LoginZustand = { fehler?: string };

const TEXTE = {
  ungueltig: "Benutzername oder Passwort stimmt nicht.",
  gedrosselt: "Zu viele Fehlversuche. Bitte in 15 Minuten noch einmal probieren.",
  gesperrt: "Dieses Konto ist gesperrt. Bitte melde dich beim Superuser.",
} as const;

function text(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === "string" ? wert.slice(0, 1024) : "";
}

export async function loginAktion(_vorher: LoginZustand, formData: FormData): Promise<LoginZustand> {
  const kontext = await anfrageKontext();
  const ergebnis = await anmelden(
    "passwort",
    { benutzername: text(formData, "benutzername"), passwort: text(formData, "passwort") },
    kontext,
  );
  if (!ergebnis.ok) return { fehler: TEXTE[ergebnis.grund] };
  await setzeSitzungsCookie(ergebnis.token, ergebnis.laeuftAbAm);
  redirect("/team");
}
