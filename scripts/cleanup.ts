// Löscht Anmeldungen und Dateien nach Ablauf der Aufbewahrungsfrist.
// Auf dem Server täglich per Cron oder Aufgabenplanung ausführen: npm run db:cleanup
import { dbSchliessen } from "../lib/server/db.ts";
import { loescheAbgelaufene } from "../lib/server/anmeldungen.ts";
import { aufbewahrungMonate, aufbewahrungProtokollTage } from "../lib/server/config.ts";
import { loescheAlteVersuche } from "../lib/server/auth/drosselung.ts";
import { loescheAltesProtokoll } from "../lib/server/auth/protokoll.ts";
import { loescheAbgelaufeneSitzungen } from "../lib/server/auth/sitzungen.ts";

const anzahl = loescheAbgelaufene();
console.log(`${anzahl} abgelaufene Anmeldung(en) gelöscht (Frist: ${aufbewahrungMonate()} Monate nach der Veranstaltung).`);
console.log(`${loescheAbgelaufeneSitzungen()} abgelaufene Sitzung(en) entfernt.`);
console.log(`${loescheAlteVersuche()} alte Fehlversuche entfernt.`);
console.log(`${loescheAltesProtokoll()} Protokolleintrag/-einträge gelöscht (Frist: ${aufbewahrungProtokollTage()} Tage).`);
dbSchliessen();
