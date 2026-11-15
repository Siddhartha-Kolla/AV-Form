// Legt erfundene Beispiel-Anmeldungen an, damit sich die Übersicht ansehen lässt.
// Nur für die Entwicklung. Aufruf: npm run db:seed
import { emptyValues, type FormValues } from "../lib/registration.ts";
import { aktualisiereAnmeldung, entscheideAnmeldung, erstelleAnmeldung, findeNachId } from "../lib/server/anmeldungen.ts";
import { speichereDatei } from "../lib/server/dateien.ts";
import { db, dbSchliessen } from "../lib/server/db.ts";
import { beispielDocx, beispielPdf, beispielWav } from "./beispieldateien.ts";

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
    titel: "Beispiel: Weihnachtskonzert",
    lehrkraft: "Frau Beispiel",
    datum: tagePlus(-30),
    beginn: "18:00",
    ende: "20:00",
    ort: "Aula",
    arten: ["konzert"],
    tech: { mikrofone: true, licht_buehne: true },
    mikrofone_anzahl: "4",
    betreuung_ton: true,
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
    const ablauf = beispielPdf([
      {
        titel: "Ablaufplan Sommerkonzert (Beispiel)",
        zeilen: [
          "17:00 Uhr  Aufbau und Soundcheck in der Aula",
          "18:00 Uhr  Einlass",
          "18:30 Uhr  Begrüßung durch die Schulleitung",
          "18:40 Uhr  Chor der Klassen 5 und 6, drei Stücke",
          "19:10 Uhr  Schulorchester, Ouvertüre und zwei Sätze",
          "19:45 Uhr  Pause, 20 Minuten",
          "20:05 Uhr  Bigband, vier Stücke, Lichtwechsel bei jedem Titel",
          "20:50 Uhr  Gemeinsames Schlusslied mit allen Beteiligten",
          "21:00 Uhr  Ende, Abbau ab 21:15 Uhr",
        ],
      },
      {
        titel: "Besonderheiten (Beispiel)",
        zeilen: [
          "Der Chor steht auf den Podesten, vier Mikrofone von oben.",
          "Das Klavier steht links und braucht zwei Mikrofone.",
          "Bei der Bigband werden die Notenpultleuchten gebraucht.",
          "Das Schlusslied läuft mit Playback vom Laptop.",
        ],
      },
    ]);
    speichereDatei(id, "Ablaufplan Sommerkonzert.pdf", ablauf);
    speichereDatei(
      id,
      "Mikrofonplan.docx",
      await beispielDocx("Mikrofonplan Sommerkonzert", [
        ["Kanal", "Quelle", "Mikrofon"],
        ["1 und 2", "Chor links", "Kondensator, Stativ"],
        ["3 und 4", "Chor rechts", "Kondensator, Stativ"],
        ["5", "Moderation", "Headset"],
        ["6 und 7", "Klavier", "Kleinmembran, Paar"],
        ["8", "Solist Bigband", "Handmikrofon"],
      ]),
    );
    speichereDatei(id, "Einspielung Schlusslied.wav", beispielWav(3, 330));
    speichereDatei(
      id,
      "Hinweise.txt",
      Buffer.from(
        [
          "Bitte den Chor eine Minute vor Beginn auf die Bühne lassen.",
          "Das Playback startet erst nach dem Zeichen der Leitung.",
          "",
        ].join("\n"),
      ),
    );
    const alt = findeNachId(id)!.values;
    aktualisiereAnmeldung(id, { ...alt, ort: "Aula (Bühne vorne)", mikrofone_anzahl: "8" });
  }
  // Ein paar Entscheidungen, damit die Übersicht nicht nur "Zu prüfen" zeigt.
  const seed = { id: "seed", name: "Technikteam (Beispiel)" };
  if (i === 0) entscheideAnmeldung(id, { status: "angenommen", nachricht: "Aufbau ab 16:30 Uhr in der Aula.", erwarteterStatus: "neu", akteur: seed });
  if (i === 1) entscheideAnmeldung(id, { status: "rueckfrage", nachricht: "Wie viele Personen sprechen auf dem Podium?", erwarteterStatus: "neu", akteur: seed });
  console.log(`${werte.titel}\n  Link der Lehrkraft: /anmeldung/${token}\n  Team-ID: ${id}`);
}
dbSchliessen();
