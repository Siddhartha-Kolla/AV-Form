import { datumLangMitWochentag } from "./format.ts";
import type { Entscheidung } from "./entscheidung.ts";

/*
  Die E-Mails des Systems als reine Funktionen: Sie liefern Betreff, Text und HTML, verschicken aber nichts.
  Das HTML ist bewusst schlicht: eine einzige Spalte, Tabellen und Inline-Styles, weil Mailprogramme
  kein modernes CSS verstehen. Es gibt keine Bilder und keine Schriften aus dem Netz.
  Jede Mail hat zusätzlich eine Textfassung für Programme, die kein HTML zeigen.

  An die Lehrkraft schreiben wir in der Sie-Form, ans Team in der du-Form.
*/

export type MailInhalt = { betreff: string; text: string; html: string };

export type Termin = { titel: string; datum: string; beginn: string; ende: string; ort: string };

const FARBE = {
  grund: "#f3f4f6",
  karte: "#ffffff",
  linie: "#e5e7eb",
  text: "#1f2937",
  gedaempft: "#6b7280",
  akzent: "#1b6b63",
};

const SCHRIFT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const STATUS_FARBE: Record<Entscheidung | "eingegangen", { text: string; grund: string }> = {
  eingegangen: { text: "#374151", grund: "#e5e7eb" },
  angenommen: { text: "#166534", grund: "#dcfce7" },
  rueckfrage: { text: "#92400e", grund: "#fef3c7" },
  abgelehnt: { text: "#991b1b", grund: "#fee2e2" },
};

/** Maskiert Text für HTML. Titel, Namen und Nachrichten stammen aus Eingaben und dürfen nie als HTML wirken. */
export function maskiere(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function absaetze(text: string): string {
  return maskiere(text).replace(/\r?\n/g, "<br>");
}

function zeitText(t: Termin): string {
  return `${datumLangMitWochentag(t.datum)}, ${t.beginn} bis ${t.ende} Uhr`;
}

function absatz(html: string): string {
  return `<p style="margin:0 0 16px;font:400 15px/1.6 ${SCHRIFT};color:${FARBE.text}">${html}</p>`;
}

function terminKasten(t: Termin): string {
  const zeile = (name: string, wert: string) =>
    `<tr><td style="padding:3px 16px 3px 0;font:400 14px/1.5 ${SCHRIFT};color:${FARBE.gedaempft};white-space:nowrap;vertical-align:top">${name}</td>` +
    `<td style="padding:3px 0;font:500 14px/1.5 ${SCHRIFT};color:${FARBE.text}">${maskiere(wert)}</td></tr>`;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border:1px solid ${FARBE.linie};border-radius:8px">` +
    `<tr><td style="padding:14px 16px">` +
    `<div style="margin:0 0 8px;font:600 16px/1.4 ${SCHRIFT};color:${FARBE.text}">${maskiere(t.titel)}</div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0">` +
    zeile("Datum", datumLangMitWochentag(t.datum)) +
    zeile("Zeit", `${t.beginn} bis ${t.ende} Uhr`) +
    zeile("Ort", t.ort) +
    `</table></td></tr></table>`
  );
}

function nachrichtKasten(ueberschrift: string, nachricht: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px">` +
    `<tr><td style="border-left:3px solid ${FARBE.akzent};padding:2px 0 2px 14px">` +
    `<div style="margin:0 0 4px;font:600 13px/1.4 ${SCHRIFT};color:${FARBE.gedaempft}">${maskiere(ueberschrift)}</div>` +
    `<div style="font:400 15px/1.6 ${SCHRIFT};color:${FARBE.text}">${absaetze(nachricht)}</div>` +
    `</td></tr></table>`
  );
}

function knopf(text: string, link: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>` +
    `<td style="border-radius:6px;background:${FARBE.akzent}">` +
    `<a href="${maskiere(link)}" style="display:inline-block;padding:11px 20px;font:600 15px/1.2 ${SCHRIFT};color:#ffffff;text-decoration:none;border-radius:6px">${maskiere(text)}</a>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 16px;font:400 13px/1.5 ${SCHRIFT};color:${FARBE.gedaempft}">Funktioniert der Knopf nicht? Dann kopieren Sie diese Adresse in Ihren Browser:<br>` +
    `<span style="word-break:break-all">${maskiere(link)}</span></p>`
  );
}

function rahmen(p: {
  vorschau: string;
  marke: { text: string; farbe: keyof typeof STATUS_FARBE };
  ueberschrift: string;
  inhalt: string;
  fuss: string;
}): string {
  const farbe = STATUS_FARBE[p.marke.farbe];
  return (
    `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">` +
    `<title>${maskiere(p.ueberschrift)}</title></head>` +
    `<body style="margin:0;padding:0;background:${FARBE.grund}">` +
    // Die Vorschau erscheint in der Postfachliste neben dem Betreff.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${maskiere(p.vorschau)}</div>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${FARBE.grund}"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px">` +
    `<tr><td style="padding:0 2px 14px;font:700 16px/1.2 ${SCHRIFT};color:${FARBE.text};letter-spacing:-0.01em">Technikteam</td></tr>` +
    `<tr><td style="background:${FARBE.karte};border:1px solid ${FARBE.linie};border-radius:10px;padding:28px 28px 12px">` +
    `<span style="display:inline-block;margin:0 0 14px;padding:4px 10px;border-radius:999px;background:${farbe.grund};font:600 12px/1.3 ${SCHRIFT};color:${farbe.text}">${maskiere(p.marke.text)}</span>` +
    `<h1 style="margin:0 0 16px;font:700 21px/1.3 ${SCHRIFT};color:${FARBE.text};letter-spacing:-0.01em">${maskiere(p.ueberschrift)}</h1>` +
    p.inhalt +
    `</td></tr>` +
    `<tr><td style="padding:16px 4px 0;font:400 12px/1.6 ${SCHRIFT};color:${FARBE.gedaempft}">${p.fuss}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

const FUSS_LEHRKRAFT =
  "Diese Nachricht kommt vom Technikteam der Schule. Sie können einfach darauf antworten.";
const FUSS_TEAM = "Automatische Nachricht aus dem Anmeldesystem des Technikteams.";

/* An die Lehrkraft ------------------------------------------------------------ */

/** Bestätigung nach dem Absenden, mit dem privaten Link. */
export function mailEingang(p: { lehrkraft: string; termin: Termin; link: string }): MailInhalt {
  const betreff = `Anmeldung eingegangen: ${p.termin.titel}`;
  const text = [
    `Guten Tag ${p.lehrkraft},`,
    "",
    `wir haben Ihre Anmeldung „${p.termin.titel}“ erhalten.`,
    "",
    `Datum: ${datumLangMitWochentag(p.termin.datum)}`,
    `Zeit: ${p.termin.beginn} bis ${p.termin.ende} Uhr`,
    `Ort: ${p.termin.ort}`,
    "",
    "Über diesen privaten Link sehen Sie den Stand, ändern Angaben und reichen Unterlagen nach:",
    p.link,
    "",
    "Der Link ist nur für Sie bestimmt. Wer ihn kennt, kann die Anmeldung ändern. Bitte geben Sie ihn nicht weiter.",
    "",
    "Wir melden uns, sobald das Team die Anmeldung geprüft hat.",
    "",
    "Viele Grüße",
    "Technikteam",
  ].join("\n");
  const html = rahmen({
    vorschau: "Ihre Anmeldung ist bei uns angekommen. Hier ist Ihr privater Link.",
    marke: { text: "Eingegangen", farbe: "eingegangen" },
    ueberschrift: "Wir haben Ihre Anmeldung erhalten",
    inhalt:
      absatz(`Guten Tag ${maskiere(p.lehrkraft)},`) +
      absatz("vielen Dank. Das Technikteam prüft Ihre Anmeldung und meldet sich bei Ihnen.") +
      terminKasten(p.termin) +
      absatz("Über Ihren privaten Link sehen Sie den Stand, ändern Angaben und reichen Unterlagen nach.") +
      knopf("Anmeldung ansehen", p.link) +
      absatz(
        "Der Link ist nur für Sie bestimmt. Wer ihn kennt, kann die Anmeldung ändern. Bitte geben Sie ihn nicht weiter.",
      ),
    fuss: FUSS_LEHRKRAFT,
  });
  return { betreff, text, html };
}

const ENTSCHEIDUNG: Record<
  Entscheidung,
  { marke: string; ueberschrift: string; einleitung: (titel: string) => string; nachricht: string; schluss: string; vorschau: string; betreff: string }
> = {
  angenommen: {
    marke: "Angenommen",
    ueberschrift: "Ihre Anmeldung ist angenommen",
    einleitung: (titel) => `das Technikteam hat Ihre Veranstaltung „${titel}“ in den Zeitplan aufgenommen.`,
    nachricht: "Nachricht vom Technikteam",
    schluss:
      "Ändert sich etwas, passen Sie die Angaben über Ihren privaten Link an. Den Link finden Sie in unserer Bestätigungsmail. Änderungen prüft das Team noch einmal.",
    vorschau: "Das Technikteam hat Ihre Veranstaltung in den Zeitplan aufgenommen.",
    betreff: "angenommen",
  },
  rueckfrage: {
    marke: "Rückfrage",
    ueberschrift: "Wir haben eine Rückfrage",
    einleitung: (titel) => `zu Ihrer Anmeldung „${titel}“ brauchen wir noch eine Auskunft von Ihnen.`,
    nachricht: "Das möchten wir von Ihnen wissen",
    schluss:
      "Antworten Sie einfach auf diese E-Mail. Sie können auch Angaben und Unterlagen über Ihren privaten Link ergänzen. Den Link finden Sie in unserer Bestätigungsmail.",
    vorschau: "Das Technikteam hat eine Frage zu Ihrer Anmeldung.",
    betreff: "Rückfrage",
  },
  abgelehnt: {
    marke: "Nicht angenommen",
    ueberschrift: "Wir können die Veranstaltung nicht aufnehmen",
    einleitung: (titel) => `leider können wir Ihre Anmeldung „${titel}“ nicht in unseren Zeitplan aufnehmen.`,
    nachricht: "Begründung",
    schluss: "Bei Fragen antworten Sie gern auf diese E-Mail.",
    vorschau: "Das Technikteam kann die Veranstaltung nicht in den Zeitplan aufnehmen.",
    betreff: "Absage",
  },
};

/** Die Entscheidung des Teams. Die Nachricht ist optional, bei einer Rückfrage ist sie der Kern. */
export function mailEntscheidung(p: {
  lehrkraft: string;
  termin: Termin;
  status: Entscheidung;
  nachricht: string | null;
  absender: string | null;
}): MailInhalt {
  const t = ENTSCHEIDUNG[p.status];
  const betreff = `Ihre Anmeldung „${p.termin.titel}“: ${t.betreff}`;
  const text = [
    `Guten Tag ${p.lehrkraft},`,
    "",
    t.einleitung(p.termin.titel),
    "",
    `${datumLangMitWochentag(p.termin.datum)}, ${p.termin.beginn} bis ${p.termin.ende} Uhr, ${p.termin.ort}`,
    ...(p.nachricht ? ["", `${t.nachricht}:`, p.nachricht] : []),
    "",
    t.schluss,
    "",
    "Viele Grüße",
    ...(p.absender ? [p.absender] : []),
    "Technikteam",
  ].join("\n");
  const html = rahmen({
    vorschau: t.vorschau,
    marke: { text: t.marke, farbe: p.status },
    ueberschrift: t.ueberschrift,
    inhalt:
      absatz(`Guten Tag ${maskiere(p.lehrkraft)},`) +
      absatz(maskiere(t.einleitung(p.termin.titel))) +
      terminKasten(p.termin) +
      (p.nachricht ? nachrichtKasten(t.nachricht, p.nachricht) : "") +
      absatz(maskiere(t.schluss)) +
      absatz(`Viele Grüße<br>${p.absender ? `${maskiere(p.absender)}, ` : ""}Technikteam`),
    fuss: FUSS_LEHRKRAFT,
  });
  return { betreff, text, html };
}

/* Ans Team -------------------------------------------------------------------- */

/** Neue Anmeldung eingegangen. */
export function mailTeamNeu(p: { lehrkraft: string; termin: Termin; link: string }): MailInhalt {
  const betreff = `Neue Anmeldung: ${p.termin.titel}`;
  const text = [
    `Neue Anmeldung von ${p.lehrkraft}:`,
    `${p.termin.titel}, ${zeitText(p.termin)}, ${p.termin.ort}`,
    "",
    "Ansehen und entscheiden:",
    p.link,
  ].join("\n");
  const html = rahmen({
    vorschau: `${p.lehrkraft} hat „${p.termin.titel}“ angemeldet.`,
    marke: { text: "Neu", farbe: "eingegangen" },
    ueberschrift: "Neue Anmeldung",
    inhalt:
      absatz(`${maskiere(p.lehrkraft)} hat eine Veranstaltung angemeldet.`) +
      terminKasten(p.termin) +
      knopf("Ansehen und entscheiden", p.link),
    fuss: FUSS_TEAM,
  });
  return { betreff, text, html };
}

/** Die Lehrkraft hat etwas geändert. Das Team soll es nicht erst später bemerken. */
export function mailTeamGeaendert(p: { lehrkraft: string; termin: Termin; link: string }): MailInhalt {
  const betreff = `Geändert: ${p.termin.titel}`;
  const text = [
    `${p.lehrkraft} hat die Anmeldung „${p.termin.titel}“ geändert.`,
    `${zeitText(p.termin)}, ${p.termin.ort}`,
    "",
    "Bitte noch einmal prüfen:",
    p.link,
  ].join("\n");
  const html = rahmen({
    vorschau: `${p.lehrkraft} hat „${p.termin.titel}“ geändert.`,
    marke: { text: "Geändert", farbe: "rueckfrage" },
    ueberschrift: "Eine Anmeldung wurde geändert",
    inhalt:
      absatz(`${maskiere(p.lehrkraft)} hat die Angaben geändert. Bitte prüfe sie noch einmal.`) +
      terminKasten(p.termin) +
      knopf("Änderungen ansehen", p.link),
    fuss: FUSS_TEAM,
  });
  return { betreff, text, html };
}
