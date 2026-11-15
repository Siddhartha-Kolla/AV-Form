import "server-only";
import { holeGeheimnis, normalisiereBenutzername } from "./konten.ts";
import { attrappePruefen, passwortPruefen } from "./passwort.ts";
import type { AnmeldeAnbieter } from "./anbieter.ts";

export const PASSWORT_ANBIETER = "passwort";

/** Benutzername und Passwort, geprüft gegen den scrypt-Hash in "identitaeten". */
export const passwortAnbieter: AnmeldeAnbieter = {
  id: PASSWORT_ANBIETER,
  anzeige: "Benutzername und Passwort",
  art: "formular",
  async pruefen(eingabe) {
    const name = normalisiereBenutzername(eingabe.benutzername ?? "");
    const passwort = eingabe.passwort ?? "";
    const hash = name ? holeGeheimnis(PASSWORT_ANBIETER, name) : null;
    if (!hash) {
      await attrappePruefen(passwort);
      return null;
    }
    return (await passwortPruefen(passwort, hash)) ? { subjekt: name } : null;
  },
};
