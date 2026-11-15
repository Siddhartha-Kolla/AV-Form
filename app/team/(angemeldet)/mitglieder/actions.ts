"use server";

import { revalidatePath } from "next/cache";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { FachFehler, type Kontext } from "@/lib/server/auth/fehler";
import type { Konto } from "@/lib/server/auth/konten";
import {
  aendereMitglied,
  beendeMitgliedSitzungen,
  legeMitgliedAn,
  loescheMitglied,
  setzeMitgliedPasswortZurueck,
  setzeMitgliedStatus,
} from "@/lib/server/auth/verwaltung";

export type Zustand = {
  ok?: boolean;
  fehler?: string;
  meldung?: string;
  /** Nur gesetzt, wenn das Passwort erzeugt wurde. Es wird einmal angezeigt und nirgends gespeichert. */
  startpasswort?: string | null;
  benutzername?: string;
};

function text(formData: FormData, name: string, max = 200): string {
  const wert = formData.get(name);
  return typeof wert === "string" ? wert.slice(0, max) : "";
}

/** Prüft bei jedem Aufruf neu, wer anfragt. Der Client wird nie als Beweis genommen. */
async function ausfuehren(
  arbeit: (akteur: Konto, kontext: Kontext) => Promise<Partial<Zustand>> | Partial<Zustand>,
): Promise<Zustand> {
  const { konto } = await verlangeSitzung({ berechtigung: "team.verwalten" });
  const kontext = await anfrageKontext();
  try {
    const ergebnis = await arbeit(konto, kontext);
    revalidatePath("/team/mitglieder");
    return { ok: true, ...ergebnis };
  } catch (fehler) {
    if (fehler instanceof FachFehler) return { ok: false, fehler: fehler.message };
    console.error(fehler);
    return { ok: false, fehler: "Das hat nicht geklappt. Bitte noch einmal probieren." };
  }
}

function eigenesPasswort(formData: FormData): string | undefined {
  return text(formData, "modus") === "eigenes" ? text(formData, "passwort", 200) : undefined;
}

export async function anlegenAktion(_vorher: Zustand, formData: FormData): Promise<Zustand> {
  return ausfuehren(async (akteur, kontext) => {
    const eingabe = {
      benutzername: text(formData, "benutzername", 64),
      anzeigename: text(formData, "anzeigename", 100),
      email: text(formData, "email"),
      rolle: text(formData, "rolle", 40),
      passwort: eigenesPasswort(formData),
    };
    const { konto, startpasswort } = await legeMitgliedAn(akteur, eingabe, kontext);
    return {
      startpasswort,
      benutzername: konto.benutzername,
      meldung: startpasswort ? undefined : `${konto.anzeigename} wurde angelegt.`,
    };
  });
}

export async function aendernAktion(_vorher: Zustand, formData: FormData): Promise<Zustand> {
  return ausfuehren((akteur, kontext) => {
    aendereMitglied(
      akteur,
      text(formData, "id", 64),
      { anzeigename: text(formData, "anzeigename", 100), email: text(formData, "email"), rolle: text(formData, "rolle", 40) },
      kontext,
    );
    return { meldung: "Gespeichert." };
  });
}

export async function statusAktion(_vorher: Zustand, formData: FormData): Promise<Zustand> {
  return ausfuehren((akteur, kontext) => {
    const gesperrt = text(formData, "status", 20) === "gesperrt";
    setzeMitgliedStatus(akteur, text(formData, "id", 64), gesperrt ? "gesperrt" : "aktiv", kontext);
    return { meldung: gesperrt ? "Konto gesperrt. Alle Sitzungen sind beendet." : "Konto wieder freigegeben." };
  });
}

export async function zuruecksetzenAktion(_vorher: Zustand, formData: FormData): Promise<Zustand> {
  return ausfuehren(async (akteur, kontext) => {
    const { startpasswort } = await setzeMitgliedPasswortZurueck(
      akteur,
      text(formData, "id", 64),
      eigenesPasswort(formData),
      kontext,
    );
    return {
      startpasswort,
      benutzername: text(formData, "benutzername", 64),
      meldung: startpasswort ? undefined : "Passwort gesetzt. Alle Sitzungen sind beendet.",
    };
  });
}

export async function sitzungenBeendenAktion(_vorher: Zustand, formData: FormData): Promise<Zustand> {
  return ausfuehren((akteur, kontext) => {
    const anzahl = beendeMitgliedSitzungen(akteur, text(formData, "id", 64), kontext);
    return { meldung: anzahl === 1 ? "Eine Sitzung beendet." : `${anzahl} Sitzungen beendet.` };
  });
}

export async function loeschenAktion(_vorher: Zustand, formData: FormData): Promise<Zustand> {
  return ausfuehren((akteur, kontext) => {
    loescheMitglied(akteur, text(formData, "id", 64), kontext);
    return { meldung: "Mitglied gelöscht." };
  });
}
