// Legt erfundene Beispiel-Anmeldungen an, damit sich die Übersicht ansehen lässt.
// Nur für die Entwicklung. Aufruf: npm run db:seed
import { emptyValues, type FormValues } from "../lib/registration.ts";
import { aktualisiereAnmeldung, erstelleAnmeldung, findeNachId } from "../lib/server/anmeldungen.ts";
import { speichereDatei } from "../lib/server/dateien.ts";
import { db, dbSchliessen } from "../lib/server/db.ts";

if (process.env.NODE_ENV === "production") {
  console.error("Beispieldaten gehören nicht auf den Produktivserver.");
  process.exit(1);
}
const vorhanden = (db().prepare("SELECT COUNT(*) AS n FROM anmeldungen").get() as { n: number }).n;
if (vorhanden > 0 && !process.argv.includes("--force")) {
  console.error(`Die Datenbank enthält schon ${vorhanden} Anmeldung(en). Mit --force trotzdem ergänzen.`);
  process.exit(1);
}

function tagePlus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function beispiel(teil: Partial<FormValues>): FormValues {
  return { ...emptyValues(), email: "beispiel@schule.invalid", ...teil };
}

const eintraege: FormValues[] = [
  beispiel({
    titel: "Beispiel: Sommerkonzert",
    lehrkraft: "Frau Beispiel",
    datum: tagePlus(19),
    beginn: "18:30",
    ende: "21:00",
    ort: "Aula",
    arten: ["konzert"],
    tech: { mikrofone: true, headsets: true, licht_buehne: true, buehne_notenstaender: true },
    mikrofone_anzahl: "6",
    headsets_anzahl: "2",
    betreuung_ton: true,
    betreuung_licht: true,
    termine: {
      ...emptyValues().termine,
      generalprobe: { datum: tagePlus(18), uhrzeit: "15:00", ort: "Aula" },
      aufbau: { datum: tagePlus(19), uhrzeit: "12:00", ort: "Aula" },
    },
  }),
  beispiel({
    titel: "Beispiel: Elternabend Jahrgang 9",
    lehrkraft: "Herr Muster",
    datum: tagePlus(45),
    beginn: "19:00",
    ende: "20:30",
    ort: "Mensa",
    arten: ["info"],
    tech: { mikrofone: true, medien_beamer: true, medien_laptop: true },
    mikrofone_anzahl: "2",
  }),
  beispiel({
    titel: "Beispiel: Theater AG, Der Besuch",
    lehrkraft: "Frau Probe",
    datum: tagePlus(70),
    beginn: "19:30",
    ende: "22:00",
    ort: "Aula",
    arten: ["theater"],
    tech: { mikrofone: true, headsets: true, licht_buehne: true, licht_spotlights: true, buehne_umbau: true },
    mikrofone_anzahl: "4",
    headsets_anzahl: "6",
    betreuung_ton: true,
    betreuung_licht: true,
    technische_details: "Headsets für die vier Hauptrollen, zwei Handmikrofone für den Chor.",
  }),
  beispiel({
    titel: "Beispiel: Podiumsdiskussion Wahl",
    lehrkraft: "Herr Beispiel",
    datum: tagePlus(8),
    beginn: "10:00",
    ende: "11:30",
    ort: "Aula",
    arten: ["podium", "vortrag"],
    tech: { mikrofone: true, medien_beamer: true },
    mikrofone_anzahl: "5",
    anmerkungen: "Ein Mikrofon für Fragen aus dem Publikum.",
  }),
  beispiel({
    titel: "Beispiel: Schulversammlung",
    lehrkraft: "Frau Muster",
    datum: tagePlus(100),
    beginn: "08:00",
    ende: "09:00",
    ort: "Sporthalle",
    arten: ["sonstiges"],
    art_sonstiges: "Verabschiedung der Abschlussklassen",
    tech: { mikrofone: true, musik_desktop: true },
    mikrofone_anzahl: "2",
  }),
];

for (const [i, werte] of eintraege.entries()) {
  const { id, token } = erstelleAnmeldung(werte);
  if (i === 0) {
    speichereDatei(id, "Beispiel-Ablaufplan.pdf", Buffer.from("Beispielinhalt"));
    speichereDatei(id, "Beispiel-Mikrofonplan.docx", Buffer.from("Beispielinhalt"));
    const alt = findeNachId(id)!.values;
    aktualisiereAnmeldung(id, { ...alt, ort: "Aula (Bühne vorne)", mikrofone_anzahl: "8" });
  }
  console.log(`${werte.titel}\n  Link der Lehrkraft: /anmeldung/${token}\n  Team-ID: ${id}`);
}
dbSchliessen();
