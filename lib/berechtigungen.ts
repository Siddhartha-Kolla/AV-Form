/*
  Rollen und Berechtigungen. Dieser Teil ist bewusst frei von Serverlogik,
  damit auch die Oberfläche ihn nutzen kann, um Knöpfe auszublenden.
  Geprüft wird trotzdem immer auf dem Server.

  Eine neue Rolle anlegen: hier einen Eintrag in ROLLEN ergänzen. Das genügt.
*/

export const BERECHTIGUNGEN = [
  "anmeldungen.lesen",
  "anmeldungen.bearbeiten",
  "anmeldungen.entscheiden",
  "anmeldungen.loeschen",
  "einsaetze.planen",
  "team.verwalten",
  "protokoll.lesen",
] as const;

export type Berechtigung = (typeof BERECHTIGUNGEN)[number];

/*
  rang: Wer eine Rolle verwaltet, muss einen höheren Rang haben als die Rolle des Kontos.
  Dadurch kann ein Admin Mitglieder anlegen, aber keine Admins, und niemand erhöht sich selbst.
*/
export const ROLLEN = {
  superuser: {
    name: "Superuser",
    rang: 3,
    beschreibung: "Verwaltet Admins und Mitglieder, sieht das Protokoll und darf alles andere auch.",
    berechtigungen: [...BERECHTIGUNGEN] as Berechtigung[],
  },
  admin: {
    name: "Admin",
    rang: 2,
    beschreibung:
      "Darf alles mit Anmeldungen, auch löschen, und verwaltet Mitglieder. Das Protokoll sieht nur der Superuser.",
    berechtigungen: BERECHTIGUNGEN.filter((b) => b !== "protokoll.lesen") as Berechtigung[],
  },
  mitglied: {
    name: "Mitglied",
    rang: 1,
    beschreibung:
      "Sieht Anmeldungen, bearbeitet sie, verwaltet deren Unterlagen und entscheidet über Annahme, Rückfrage und Ablehnung. Löschen dürfen nur Admin und Superuser.",
    berechtigungen: ["anmeldungen.lesen", "anmeldungen.bearbeiten", "anmeldungen.entscheiden"] as Berechtigung[],
  },
} as const;

export type RolleId = keyof typeof ROLLEN;

export function istRolle(wert: string): wert is RolleId {
  return Object.prototype.hasOwnProperty.call(ROLLEN, wert);
}

export function darf(rolle: string, berechtigung: Berechtigung): boolean {
  return istRolle(rolle) && ROLLEN[rolle].berechtigungen.includes(berechtigung);
}

/** Der Superuser ist einmalig und wird nur über die Kommandozeile angelegt. */
const VERGEBBARE_ROLLEN: RolleId[] = (Object.keys(ROLLEN) as RolleId[]).filter((r) => r !== "superuser");

/** Rollen, die dieser Akteur beim Anlegen oder Ändern vergeben darf: nur solche mit niedrigerem Rang als die eigene. */
export function vergebbareRollen(akteurRolle: string): RolleId[] {
  if (!istRolle(akteurRolle)) return [];
  return VERGEBBARE_ROLLEN.filter((r) => ROLLEN[r].rang < ROLLEN[akteurRolle].rang);
}

/**
 * Darf der Akteur ein Konto mit dieser Rolle verwalten (ändern, sperren, zurücksetzen, löschen)?
 * Der Superuser darf alle, andere nur Konten mit niedrigerem Rang. Den Schutz des Superuser-Kontos selbst
 * übernimmt die Serverlogik zusätzlich.
 */
export function darfKontoVerwalten(akteurRolle: string, zielRolle: string): boolean {
  if (!istRolle(akteurRolle) || !istRolle(zielRolle)) return false;
  return akteurRolle === "superuser" || ROLLEN[akteurRolle].rang > ROLLEN[zielRolle].rang;
}
