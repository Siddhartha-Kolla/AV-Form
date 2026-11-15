/*
  Rollen und Berechtigungen. Dieser Teil ist bewusst frei von Serverlogik,
  damit auch die Oberfläche ihn nutzen kann, um Knöpfe auszublenden.
  Geprüft wird trotzdem immer auf dem Server.

  Eine neue Rolle anlegen: hier einen Eintrag in ROLLEN ergänzen. Das genügt.
*/

export const BERECHTIGUNGEN = [
  "anmeldungen.lesen",
  "anmeldungen.loeschen",
  "team.verwalten",
  "protokoll.lesen",
] as const;

export type Berechtigung = (typeof BERECHTIGUNGEN)[number];

export const ROLLEN = {
  superuser: {
    name: "Superuser",
    beschreibung: "Verwaltet Mitglieder, sieht das Protokoll und darf alles andere auch.",
    berechtigungen: [...BERECHTIGUNGEN] as Berechtigung[],
  },
  mitglied: {
    name: "Mitglied",
    beschreibung: "Sieht die Anmeldungen und lädt Unterlagen herunter.",
    berechtigungen: ["anmeldungen.lesen"] as Berechtigung[],
  },
} as const;

export type RolleId = keyof typeof ROLLEN;

export function istRolle(wert: string): wert is RolleId {
  return Object.prototype.hasOwnProperty.call(ROLLEN, wert);
}

export function darf(rolle: string, berechtigung: Berechtigung): boolean {
  return istRolle(rolle) && ROLLEN[rolle].berechtigungen.includes(berechtigung);
}

/** Rollen, die ein Superuser beim Anlegen oder Ändern vergeben darf. Es gibt genau einen Superuser. */
export const VERGEBBARE_ROLLEN: RolleId[] = (Object.keys(ROLLEN) as RolleId[]).filter((r) => r !== "superuser");
