import "server-only";

/** Ein Fehler, dessen Text bedenkenlos in der Oberfläche stehen darf. Alles andere bleibt intern. */
export class FachFehler extends Error {}

export type Kontext = { ip: string | null; geraet: string | null };

export const OHNE_KONTEXT: Kontext = { ip: null, geraet: null };
