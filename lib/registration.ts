import { z } from "zod";

export const ARTEN = [
  { id: "theater", label: "Theater", weeks: 4 },
  { id: "konzert", label: "Konzert", weeks: 4 },
  { id: "info", label: "Informationsveranstaltung", weeks: 2 },
  { id: "podium", label: "Podiumsdiskussion", weeks: 2 },
  { id: "vortrag", label: "Vortrag", weeks: 2 },
  { id: "sonstiges", label: "Sonstiges", weeks: null },
] as const;

export type ArtId = (typeof ARTEN)[number]["id"];

export type TechItem = {
  id: string;
  label: string;
  count?: "mikrofone_anzahl" | "headsets_anzahl";
  /** Wählt man diesen Punkt, werden die genannten Punkte der Gruppe abgewählt. */
  excludes?: string[];
};

export const TECH_GROUPS: { id: string; label: string; items: TechItem[] }[] = [
  {
    id: "ton",
    label: "Ton",
    items: [
      { id: "ton_kein", label: "Kein Ton erforderlich", excludes: ["mikrofone", "headsets", "musik_desktop"] },
      { id: "mikrofone", label: "Mikrofone", count: "mikrofone_anzahl", excludes: ["ton_kein"] },
      { id: "headsets", label: "Headsets", count: "headsets_anzahl", excludes: ["ton_kein"] },
      { id: "musik_desktop", label: "Musikwiedergabe (Desktop)", excludes: ["ton_kein"] },
    ],
  },
  {
    id: "licht",
    label: "Licht",
    items: [
      { id: "licht_raumlicht", label: "Raum- oder Saallicht reicht", excludes: ["licht_buehne", "licht_spotlights"] },
      { id: "licht_buehne", label: "Bühnenlicht", excludes: ["licht_raumlicht"] },
      { id: "licht_spotlights", label: "Spotlights", excludes: ["licht_raumlicht"] },
    ],
  },
  {
    id: "medien",
    label: "Medien",
    items: [
      { id: "medien_beamer", label: "Beamer / BIMA" },
      { id: "medien_laptop", label: "Laptopanschluss" },
    ],
  },
  {
    id: "buehne",
    label: "Bühne",
    items: [
      { id: "buehne_rednerpult", label: "Rednerpult" },
      { id: "buehne_notenstaender", label: "Notenständer" },
      { id: "buehne_notenpultleuchten", label: "Notenpultleuchten" },
      { id: "buehne_umbau", label: "Bühnenumbau" },
    ],
  },
];

export const TERMINE = [
  { id: "probe", label: "Probe(n)", freitext: true },
  { id: "generalprobe", label: "Generalprobe", freitext: false },
  { id: "aufbau", label: "Aufbau", freitext: false },
  { id: "veranstaltung", label: "Veranstaltung", freitext: false },
  { id: "abbau", label: "Abbau", freitext: false },
] as const;

export type TerminId = (typeof TERMINE)[number]["id"];
export type Termin = { datum: string; uhrzeit: string; ort: string };

export type FormValues = {
  titel: string;
  lehrkraft: string;
  email: string;
  datum: string;
  beginn: string;
  ende: string;
  ort: string;
  arten: ArtId[];
  art_sonstiges: string;
  tech: Record<string, boolean>;
  mikrofone_anzahl: string;
  headsets_anzahl: string;
  betreuung_ton: boolean;
  betreuung_licht: boolean;
  technische_details: string;
  termine: Record<TerminId, Termin>;
  anmerkungen: string;
};

export function emptyValues(): FormValues {
  const leer: Termin = { datum: "", uhrzeit: "", ort: "" };
  return {
    titel: "",
    lehrkraft: "",
    email: "",
    datum: "",
    beginn: "",
    ende: "",
    ort: "",
    arten: [],
    art_sonstiges: "",
    tech: {},
    mikrofone_anzahl: "",
    headsets_anzahl: "",
    betreuung_ton: false,
    betreuung_licht: false,
    technische_details: "",
    termine: {
      probe: { ...leer },
      generalprobe: { ...leer },
      aufbau: { ...leer },
      veranstaltung: { ...leer },
      abbau: { ...leer },
    },
    anmerkungen: "",
  };
}

/* Unterlagen ------------------------------------------------------------ */

export type DokumentKategorie =
  | "skript"
  | "ablaufplan"
  | "mikrofonplan"
  | "praesentation"
  | "zuspielung"
  | "sonstiges";

export const DOKUMENTE: Record<
  DokumentKategorie,
  { label: string; hint: string; fuer: ArtId[] }
> = {
  skript: {
    label: "Vollständiges Skript",
    hint: "Licht-Cues grün markieren, Ton-Cues rot. Cues eindeutig benennen, zum Beispiel „Übergang zu Cue 2“ oder „Türgeräusch abspielen“. Hinweise zu Spotlights und Beamer gehören ebenfalls ins Skript.",
    fuer: ["theater"],
  },
  ablaufplan: {
    label: "Ablaufplan",
    hint: "Zeitlicher Ablauf: Proben, Einlass, Beginn, Reihenfolge der Programmpunkte, Pausen, Ende und besondere Umbauten. Bei Konzerten dazu die Lichtwechsel mit Zeitpunkt.",
    fuer: ["konzert", "podium", "info", "vortrag"],
  },
  mikrofonplan: {
    label: "Mikrofonplan",
    hint: "Welche Person bekommt welches Mikrofon, bei Bedarf mit Kanalzuordnung. Bei Diskussionen ein Mikrofon für Fragen aus dem Publikum nicht vergessen.",
    fuer: ["konzert", "podium", "info", "vortrag"],
  },
  praesentation: {
    label: "Präsentationen oder Videos",
    hint: "Dazu kurze Hinweise zu Beamer oder BIMA und zur gewünschten Lichtstimmung.",
    fuer: ["podium", "info", "vortrag"],
  },
  zuspielung: {
    label: "Musikeinspielungen und Zuspielungen",
    hint: "Titel in der Reihenfolge, in der sie laufen sollen.",
    fuer: ["konzert"],
  },
  sonstiges: {
    label: "Sonstige technische Hinweise",
    hint: "Alles, was für Licht, Ton oder Medien wichtig ist und anderswo nicht passt.",
    fuer: ["theater"],
  },
};

export function benoetigteDokumente(arten: ArtId[]): DokumentKategorie[] {
  return (Object.keys(DOKUMENTE) as DokumentKategorie[]).filter((k) =>
    DOKUMENTE[k].fuer.some((a) => arten.includes(a)),
  );
}

/** Platzhalter, bis die Schule das Limit festlegt. */
export const MAX_DATEI_MB = 20;
export const ERLAUBTE_ENDUNGEN = ["pdf", "docx", "doc", "pptx", "odt", "txt", "mp3", "wav"];

export function pruefeDatei(file: File): string | null {
  const endung = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ERLAUBTE_ENDUNGEN.includes(endung)) {
    return `Dieser Dateityp wird nicht angenommen. Erlaubt sind ${ERLAUBTE_ENDUNGEN.join(", ")}.`;
  }
  if (file.size > MAX_DATEI_MB * 1024 * 1024) {
    return `Die Datei ist größer als ${MAX_DATEI_MB} MB. Bitte verkleinern oder aufteilen.`;
  }
  return null;
}

export function dateiGroesse(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/* Frist ----------------------------------------------------------------- */

export type Frist =
  | { status: "absprache" }
  | { status: "vergangen" }
  | { status: "ok" | "knapp"; vorhanden: number; noetig: number; art: string; mehrere: boolean };

export function parseDatum(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tageBis(iso: string, heute: Date): number | null {
  const ziel = parseDatum(iso);
  if (!ziel) return null;
  const start = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return Math.round((ziel.getTime() - start.getTime()) / 86_400_000);
}

export function fristPruefen(datum: string, arten: ArtId[], heute: Date | null): Frist | null {
  if (!heute) return null;
  const tage = tageBis(datum, heute);
  if (tage === null || arten.length === 0) return null;
  if (tage < 0) return { status: "vergangen" };

  const mitFrist = ARTEN.filter((a) => a.weeks !== null && arten.includes(a.id));
  if (mitFrist.length === 0) return { status: "absprache" };

  const streng = mitFrist.reduce((a, b) => (b.weeks! > a.weeks! ? b : a));
  const noetig = streng.weeks! * 7;
  return {
    status: tage >= noetig ? "ok" : "knapp",
    vorhanden: tage,
    noetig,
    art: streng.label,
    mehrere: mitFrist.length > 1,
  };
}

/* Validierung ----------------------------------------------------------- */

const pflicht = (msg: string) => z.string().trim().min(1, msg);

const schema = z
  .object({
    titel: pflicht("Bitte den Titel der Veranstaltung angeben."),
    lehrkraft: pflicht("Bitte die verantwortliche Lehrkraft angeben."),
    email: pflicht("Bitte eine E-Mail-Adresse angeben.").pipe(
      z.email("Diese E-Mail-Adresse sieht nicht vollständig aus."),
    ),
    datum: pflicht("Bitte das Datum angeben."),
    beginn: pflicht("Bitte die Beginnzeit angeben."),
    ende: pflicht("Bitte die Endzeit angeben."),
    ort: pflicht("Bitte den Veranstaltungsort angeben."),
  })
  .loose();

export type Fehler = Record<string, string>;

/** `heute` ist null, solange die Uhrzeit des Browsers noch nicht bekannt ist (Prerender). */
export function validate(v: FormValues, heute: Date | null): Fehler {
  const fehler: Fehler = {};

  const res = schema.safeParse(v);
  if (!res.success) {
    for (const issue of res.error.issues) {
      const key = String(issue.path[0]);
      if (!(key in fehler)) fehler[key] = issue.message;
    }
  }

  if (!fehler.datum && heute) {
    const tage = tageBis(v.datum, heute);
    if (tage === null) fehler.datum = "Bitte das Datum im Format TT.MM.JJJJ angeben.";
    else if (tage < 0) fehler.datum = "Dieses Datum liegt in der Vergangenheit.";
  }

  if (!fehler.beginn && !fehler.ende && v.ende <= v.beginn) {
    fehler.ende = "Das Ende muss nach dem Beginn liegen.";
  }

  if (v.arten.includes("sonstiges") && !v.art_sonstiges.trim()) {
    fehler.art_sonstiges = "Bitte kurz beschreiben, um welche Art von Veranstaltung es geht.";
  }

  for (const key of ["mikrofone", "headsets"] as const) {
    if (v.tech[key]) {
      const feld = `${key}_anzahl` as const;
      const n = Number(v[feld]);
      if (!Number.isInteger(n) || n < 1) fehler[feld] = "Bitte eine Anzahl ab 1 angeben.";
    }
  }

  return fehler;
}
