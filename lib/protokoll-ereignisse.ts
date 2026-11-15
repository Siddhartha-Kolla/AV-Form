/** Ereignisse im Protokoll mit deutscher Beschriftung. Neue Ereignisse hier eintragen. */

export const EREIGNISSE = {
  "login.erfolg": { text: "Angemeldet", gruppe: "anmeldung" },
  "login.fehlgeschlagen": { text: "Anmeldung fehlgeschlagen", gruppe: "anmeldung" },
  "login.gedrosselt": { text: "Anmeldung blockiert, zu viele Versuche", gruppe: "anmeldung" },
  "login.gesperrt": { text: "Anmeldung eines gesperrten Kontos", gruppe: "anmeldung" },
  "login.kein_konto": { text: "Anmeldung ohne zugeordnetes Konto", gruppe: "anmeldung" },
  logout: { text: "Abgemeldet", gruppe: "anmeldung" },
  "sitzungen.beendet": { text: "Sitzungen beendet", gruppe: "anmeldung" },
  "passwort.geaendert": { text: "Passwort geändert", gruppe: "konten" },
  "passwort.zurueckgesetzt": { text: "Passwort zurückgesetzt", gruppe: "konten" },
  "konto.angelegt": { text: "Konto angelegt", gruppe: "konten" },
  "konto.geaendert": { text: "Konto geändert", gruppe: "konten" },
  "konto.gesperrt": { text: "Konto gesperrt", gruppe: "konten" },
  "konto.entsperrt": { text: "Konto entsperrt", gruppe: "konten" },
  "konto.geloescht": { text: "Konto gelöscht", gruppe: "konten" },
  "cli.superuser_angelegt": { text: "Superuser über die Kommandozeile angelegt", gruppe: "konten" },
  "cli.passwort_zurueckgesetzt": { text: "Passwort über die Kommandozeile zurückgesetzt", gruppe: "konten" },
  "anmeldung.angesehen": { text: "Anmeldung angesehen", gruppe: "daten" },
  "anmeldung.bearbeitet": { text: "Anmeldung bearbeitet", gruppe: "daten" },
  "anmeldung.entschieden": { text: "Über Anmeldung entschieden", gruppe: "daten" },
  "anmeldung.geloescht": { text: "Anmeldung gelöscht", gruppe: "daten" },
  "datei.angesehen": { text: "Datei in der Vorschau angesehen", gruppe: "daten" },
  "datei.heruntergeladen": { text: "Datei heruntergeladen", gruppe: "daten" },
} as const;

export type EreignisId = keyof typeof EREIGNISSE;

export const GRUPPEN = {
  anmeldung: "Anmeldung und Sitzungen",
  konten: "Konten und Passwörter",
  daten: "Zugriff auf Anmeldungen",
} as const;

export type GruppeId = keyof typeof GRUPPEN;

export function ereignisText(id: string): string {
  return (EREIGNISSE as Record<string, { text: string }>)[id]?.text ?? id;
}

export function ereignisseDerGruppe(gruppe: GruppeId): EreignisId[] {
  return (Object.keys(EREIGNISSE) as EreignisId[]).filter((k) => EREIGNISSE[k].gruppe === gruppe);
}
