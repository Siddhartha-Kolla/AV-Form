// Löscht Anmeldungen und Dateien nach Ablauf der Aufbewahrungsfrist.
// Auf dem Server täglich per Cron oder Aufgabenplanung ausführen: npm run db:cleanup
import { dbSchliessen } from "../lib/server/db.ts";
import { loescheAbgelaufene } from "../lib/server/anmeldungen.ts";
import { aufbewahrungMonate } from "../lib/server/config.ts";

const anzahl = loescheAbgelaufene();
console.log(`${anzahl} abgelaufene Anmeldung(en) gelöscht (Frist: ${aufbewahrungMonate()} Monate nach der Veranstaltung).`);
dbSchliessen();
