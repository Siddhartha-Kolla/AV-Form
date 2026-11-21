import { besetzungText, type BesetzungKurz } from "./besetzung.ts";
import { betreuungNoetig, technikKurz } from "./dashboard.ts";
import { TERMINE, type FormValues } from "./registration.ts";

/*
  Kalender-Dateien (iCalendar, .ics). Reine Funktionen ohne Datenbank, damit sich alles testen lässt.

  Was in einem Eintrag steht, ist bewusst knapp: Titel, Zeit, Ort, die Technik in Kurzform, die Besetzung in Zahlen
  und ein Link zur Anmeldung. Namen und E-Mail-Adressen der Lehrkraft, ihre Anmerkungen, Notizen und Dateien
  verlassen die App nie über den Kalender, denn Google und Apple speichern, was sie abrufen.
*/

const ZEITZONE = "Europe/Berlin";

/** Ein Zeitpunkt in Berliner Ortszeit. Ohne Uhrzeit ist es ein Tag, an dem etwas ganztägig stattfindet. */
export type Zeitpunkt = { datum: string; zeit: string | null };

export type KalenderEreignis = {
  uid: string;
  titel: string;
  ort: string;
  beschreibung: string;
  beginn: Zeitpunkt;
  /** Bei Ganztägigem der erste Tag danach, so verlangt es das Format. */
  ende: Zeitpunkt;
  /** Wann sich die Anmeldung zuletzt geändert hat (ISO). */
  geaendert: string;
  sequenz: number;
  erinnerung: boolean;
};

/* Datum und Uhrzeit ----------------------------------------------------------- */

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const UHRZEIT = /^\d{2}:\d{2}$/;

function alsMs(datum: string, zeit: string): number {
  const [j, m, t] = datum.split("-").map(Number);
  const [h, min] = zeit.split(":").map(Number);
  return Date.UTC(j, m - 1, t, h, min);
}

function ausMs(ms: number): { datum: string; zeit: string } {
  const iso = new Date(ms).toISOString();
  return { datum: iso.slice(0, 10), zeit: iso.slice(11, 16) };
}

/** Das Datum eine Anzahl Tage später (oder früher bei negativen Zahlen). */
export function datumPlus(datum: string, tage: number): string {
  return ausMs(alsMs(datum, "00:00") + tage * 86_400_000).datum;
}

/** Die Uhrzeiten, die in einem freien Text stehen, zum Beispiel "17:00 bis 19:30 Uhr" oder "17.30". */
export function zeitenAusText(text: string): string[] {
  return [...text.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
}

function ganztaegig(datum: string): { beginn: Zeitpunkt; ende: Zeitpunkt } {
  return { beginn: { datum, zeit: null }, ende: { datum: datumPlus(datum, 1), zeit: null } };
}

/** Beginn und Ende der Veranstaltung. Liegt das Ende nicht nach dem Beginn, endet sie am nächsten Tag. */
function hauptZeit(datum: string, beginn: string, ende: string): { beginn: Zeitpunkt; ende: Zeitpunkt } {
  if (!UHRZEIT.test(beginn)) return ganztaegig(datum);
  const start = alsMs(datum, beginn);
  let schluss = UHRZEIT.test(ende) ? alsMs(datum, ende) : start + 3_600_000;
  if (schluss <= start) schluss = UHRZEIT.test(ende) ? schluss + 86_400_000 : start + 3_600_000;
  return { beginn: { datum, zeit: beginn }, ende: ausMs(schluss) };
}

/** Ein Termin im Ablauf. Ohne erkennbare Uhrzeit wird er ganztägig, ohne Ende dauert er eine Stunde. */
function nebenZeit(datum: string, uhrzeit: string): { beginn: Zeitpunkt; ende: Zeitpunkt } {
  const zeiten = zeitenAusText(uhrzeit);
  if (zeiten.length === 0) return ganztaegig(datum);
  const start = alsMs(datum, zeiten[0]);
  const schluss = zeiten[1] && zeiten[1] > zeiten[0] ? alsMs(datum, zeiten[1]) : start + 3_600_000;
  return { beginn: { datum, zeit: zeiten[0] }, ende: ausMs(schluss) };
}

/* Einträge einer Anmeldung ----------------------------------------------------- */

const NEBENTERMINE: Record<string, string> = { probe: "Probe", generalprobe: "Generalprobe", aufbau: "Aufbau", abbau: "Abbau" };

export type AnmeldungFuerKalender = {
  id: string;
  values: FormValues;
  revision: number;
  geaendertAm: string;
};

/**
 * Die Kalendereinträge zu einer Anmeldung: die Veranstaltung selbst und jeder Termin im Ablauf, der ein echtes
 * Datum hat (Probe, Generalprobe, Aufbau, Abbau). Texte wie "jeden Dienstag" lassen sich nicht einordnen und fehlen.
 * Die Erinnerung am Vortag gibt es nur beim Haupttermin.
 */
export function ereignisseFuerAnmeldung(
  a: AnmeldungFuerKalender,
  optionen: { basisUrl: string | null; besetzung?: Pick<BesetzungKurz, "pflicht" | "benoetigt" | "dabei">; erinnerung: boolean },
): KalenderEreignis[] {
  const v = a.values;
  if (!DATUM.test(v.datum)) return [];
  const link = optionen.basisUrl ? `Details: ${optionen.basisUrl}/team/anmeldungen/${a.id}` : null;
  const b = optionen.besetzung;
  const pflicht = !!b?.pflicht;

  const technik = technikKurz(v);
  const techniker = betreuungNoetig(v);
  const besetzungsZeile =
    b && (b.pflicht || b.benoetigt !== null || b.dabei > 0)
      ? `Besetzung: ${[b.pflicht && "Pflicht", besetzungText(b)].filter(Boolean).join(", ")}`
      : null;

  const ereignisse: KalenderEreignis[] = [
    {
      uid: `${a.id}-veranstaltung@technikteam`,
      titel: pflicht ? `Pflicht: ${v.titel}` : v.titel,
      ort: v.ort,
      beschreibung: [
        technik !== "Keine Technik angegeben" && `Technik: ${technik}`,
        techniker && `Techniker: ${techniker}`,
        besetzungsZeile,
        link,
      ]
        .filter(Boolean)
        .join("\n"),
      ...hauptZeit(v.datum, v.beginn, v.ende),
      geaendert: a.geaendertAm,
      sequenz: a.revision,
      erinnerung: optionen.erinnerung,
    },
  ];

  for (const t of TERMINE) {
    if (t.id === "veranstaltung") continue;
    const x = v.termine[t.id];
    if (!x || !DATUM.test(x.datum)) continue;
    ereignisse.push({
      uid: `${a.id}-${t.id}@technikteam`,
      titel: `${NEBENTERMINE[t.id] ?? t.label}: ${v.titel}`,
      ort: x.ort.trim() || v.ort,
      beschreibung: [`Zu: ${v.titel}`, link].filter(Boolean).join("\n"),
      ...nebenZeit(x.datum, x.uhrzeit),
      geaendert: a.geaendertAm,
      sequenz: a.revision,
      erinnerung: false,
    });
  }
  return ereignisse;
}

/* Die Datei --------------------------------------------------------------------- */

/** Maskiert Text für einen Wert im Format und entfernt Steuerzeichen, damit nichts neue Zeilen einschleusen kann. */
export function icsText(text: string): string {
  return text
    .replace(/\r\n|\r/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Bricht eine Zeile nach höchstens 75 Byte um (Fortsetzungszeilen beginnen mit einem Leerzeichen), ohne ein Zeichen zu zerteilen. */
export function falte(zeile: string): string {
  const kodierer = new TextEncoder();
  const teile: string[] = [];
  let aktuell = "";
  let laenge = 0;
  let grenze = 75;
  for (const zeichen of zeile) {
    const n = kodierer.encode(zeichen).length;
    if (laenge + n > grenze) {
      teile.push(aktuell);
      aktuell = "";
      laenge = 0;
      grenze = 74;
    }
    aktuell += zeichen;
    laenge += n;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

function utcStempel(iso: string): string {
  const d = new Date(iso);
  return (Number.isNaN(d.getTime()) ? new Date(0) : d).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function zeitZeile(name: "DTSTART" | "DTEND", z: Zeitpunkt): string {
  const tag = z.datum.replaceAll("-", "");
  return z.zeit ? `${name};TZID=${ZEITZONE}:${tag}T${z.zeit.replace(":", "")}00` : `${name};VALUE=DATE:${tag}`;
}

// Die Regeln der Sommerzeit in der EU, damit jeder Kalender die Uhrzeiten richtig umrechnet.
const ZEITZONEN_BLOCK = [
  "BEGIN:VTIMEZONE",
  `TZID:${ZEITZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Baut die .ics-Datei. Zeilenenden sind CRLF, so verlangt es das Format. */
export function baueKalender(optionen: { name: string; ereignisse: KalenderEreignis[] }): string {
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Technikteam//Veranstaltungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(optionen.name)}`,
    `X-WR-TIMEZONE:${ZEITZONE}`,
    // Wie oft ein Kalender nachfragen soll. Manche Programme halten sich daran, Google meist nicht.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...ZEITZONEN_BLOCK,
  ];
  for (const e of optionen.ereignisse) {
    zeilen.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${utcStempel(e.geaendert)}`,
      `LAST-MODIFIED:${utcStempel(e.geaendert)}`,
      `SEQUENCE:${e.sequenz}`,
      `SUMMARY:${icsText(e.titel)}`,
      zeitZeile("DTSTART", e.beginn),
      zeitZeile("DTEND", e.ende),
    );
    if (e.ort.trim()) zeilen.push(`LOCATION:${icsText(e.ort)}`);
    if (e.beschreibung) zeilen.push(`DESCRIPTION:${icsText(e.beschreibung)}`);
    zeilen.push("STATUS:CONFIRMED", "TRANSP:OPAQUE");
    if (e.erinnerung) {
      zeilen.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`Morgen: ${e.titel}`)}`, "TRIGGER:-P1D", "END:VALARM");
    }
    zeilen.push("END:VEVENT");
  }
  zeilen.push("END:VCALENDAR");
  return zeilen.map(falte).join("\r\n") + "\r\n";
}

/** Ein Dateiname aus dem Titel, nur mit Buchstaben, Ziffern und Bindestrichen. */
export function dateiname(titel: string): string {
  const rest = titel
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${rest || "veranstaltung"}.ics`;
}
