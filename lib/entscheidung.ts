/*
  Status einer Anmeldung und die Entscheidung des Teams. Reine Funktionen ohne Datenbank,
  damit Übersicht, Detailseite und Tests dasselbe benutzen.

  neu         Eingegangen, das Team hat noch nicht entschieden.
  angenommen  Die Veranstaltung steht im Zeitplan.
  rueckfrage  Das Team hat der Lehrkraft eine Frage gestellt und wartet auf die Antwort.
  abgelehnt   Die Veranstaltung ist nicht im Zeitplan. Sie verschwindet aus der Übersicht,
              bleibt aber unter dem Status "Abgelehnt" auffindbar, bis die Aufbewahrungsfrist endet.
*/

export const STATUS = {
  neu: { text: "Zu prüfen" },
  angenommen: { text: "Angenommen" },
  rueckfrage: { text: "Rückfrage offen" },
  abgelehnt: { text: "Abgelehnt" },
} as const;

export type StatusId = keyof typeof STATUS;

export function istStatus(wert: unknown): wert is StatusId {
  return typeof wert === "string" && Object.prototype.hasOwnProperty.call(STATUS, wert);
}

/** Was das Team entscheiden kann. "neu" wird nur durch die Lehrkraft wieder gesetzt, wenn sie etwas ändert. */
export type Entscheidung = Exclude<StatusId, "neu">;
export const ENTSCHEIDUNGEN: Entscheidung[] = ["angenommen", "rueckfrage", "abgelehnt"];

export function istEntscheidung(wert: unknown): wert is Entscheidung {
  return typeof wert === "string" && (ENTSCHEIDUNGEN as string[]).includes(wert);
}

export const MAX_NACHRICHT = 1000;

/** Texte für die Dialoge des Teams. */
export const ENTSCHEIDUNGS_TEXTE: Record<
  Entscheidung,
  { knopf: string; titel: string; beschreibung: string; feld: string; hinweis: string; pflicht: boolean; speichern: string }
> = {
  angenommen: {
    knopf: "Annehmen",
    titel: "Anmeldung annehmen",
    beschreibung: "Die Veranstaltung steht damit im Zeitplan.",
    feld: "Nachricht an die Lehrkraft (optional)",
    hinweis: "Zum Beispiel eine Bestätigung mit dem Zeitpunkt des Aufbaus.",
    pflicht: false,
    speichern: "Annehmen",
  },
  rueckfrage: {
    knopf: "Rückfrage stellen",
    titel: "Rückfrage an die Lehrkraft",
    beschreibung: "Die Anmeldung bleibt im Zeitplan, bis die Lehrkraft geantwortet hat.",
    feld: "Was soll die Lehrkraft klären oder nachreichen?",
    hinweis: "Schreibe so, dass die Lehrkraft ohne Nachfrage antworten kann.",
    pflicht: true,
    speichern: "Rückfrage speichern",
  },
  abgelehnt: {
    knopf: "Ablehnen",
    titel: "Anmeldung ablehnen",
    beschreibung:
      "Die Veranstaltung verschwindet aus dem Zeitplan und der Übersicht. Du findest sie weiter unter dem Status „Abgelehnt“.",
    feld: "Begründung für die Lehrkraft (optional)",
    hinweis: "Eine kurze Begründung erspart der Lehrkraft die Nachfrage.",
    pflicht: false,
    speichern: "Ablehnen",
  },
};

/** Prüft die Eingabe einer Entscheidung. Gibt eine Fehlermeldung zurück oder null. */
export function pruefeEntscheidung(status: unknown, nachricht: string): string | null {
  if (!istEntscheidung(status)) return "Diese Entscheidung gibt es nicht.";
  if (nachricht.length > MAX_NACHRICHT) return `Die Nachricht darf höchstens ${MAX_NACHRICHT} Zeichen lang sein.`;
  if (ENTSCHEIDUNGS_TEXTE[status].pflicht && !nachricht.trim()) return "Bitte schreibe, was die Lehrkraft klären soll.";
  return null;
}

/**
 * Ein vorbereiteter Entwurf an die Lehrkraft, als mailto-Link. Solange das System selbst keine Mails
 * verschickt, öffnet das Team damit sein Mailprogramm. Absender und Text lassen sich dort noch anpassen.
 */
export function mailAnLehrkraft(p: {
  email: string;
  lehrkraft: string;
  titel: string;
  status: Entscheidung;
  nachricht: string | null;
  absender: string;
}): string {
  const einleitung: Record<Entscheidung, string> = {
    angenommen: `Ihre Anmeldung „${p.titel}“ ist bei uns angekommen und angenommen.`,
    rueckfrage: `zu Ihrer Anmeldung „${p.titel}“ haben wir eine Rückfrage.`,
    abgelehnt: `leider können wir Ihre Anmeldung „${p.titel}“ nicht in unseren Zeitplan aufnehmen.`,
  };
  const betreff: Record<Entscheidung, string> = {
    angenommen: "angenommen",
    rueckfrage: "Rückfrage",
    abgelehnt: "Absage",
  };
  const text = [
    `Guten Tag ${p.lehrkraft},`,
    "",
    einleitung[p.status],
    ...(p.nachricht ? ["", p.nachricht] : []),
    "",
    "Viele Grüße",
    p.absender,
    "Technikteam",
  ].join("\r\n");
  const parameter = `subject=${encodeURIComponent(`Ihre Anmeldung „${p.titel}“: ${betreff[p.status]}`)}&body=${encodeURIComponent(text)}`;
  return `mailto:${encodeURIComponent(p.email).replace("%40", "@")}?${parameter}`;
}
