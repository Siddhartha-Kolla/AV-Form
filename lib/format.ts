const ZEITZONE = "Europe/Berlin";

/** "15.11.2026, 14:32", immer in deutscher Zeit, egal wo der Server läuft. */
export function datumZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZEITZONE,
  });
}

export function datumZeitMitSekunden(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: ZEITZONE,
  });
}

/** Kurze Beschreibung eines Geräts aus dem User-Agent, zum Beispiel "Chrome auf Windows". */
export function geraetKurz(userAgent: string | null): string {
  if (!userAgent) return "Unbekanntes Gerät";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : null;
  const system = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad|iPod/.test(userAgent)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux|X11/.test(userAgent)
            ? "Linux"
            : null;
  if (browser && system) return `${browser} auf ${system}`;
  return browser ?? system ?? userAgent.slice(0, 40);
}

/** Heutiges Datum in deutscher Zeit als "JJJJ-MM-TT". */
export function heuteBerlin(jetzt: Date = new Date()): string {
  return jetzt.toLocaleDateString("sv-SE", { timeZone: ZEITZONE });
}

function alsUtcTag(iso: string): number {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(j, m - 1, t);
}

/** Tage von a bis b (positiv, wenn b später liegt). */
export function tageZwischen(vonIso: string, bisIso: string): number {
  return Math.round((alsUtcTag(bisIso) - alsUtcTag(vonIso)) / 86_400_000);
}

/** "Do., 17.06." */
export function datumKurz(iso: string): string {
  return new Date(alsUtcTag(iso)).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** "Donnerstag, 17. Juni 2027" */
export function datumLangMitWochentag(iso: string): string {
  return new Date(alsUtcTag(iso)).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Juni 2027" aus "2027-06" */
export function monatTitel(monat: string): string {
  return new Date(alsUtcTag(`${monat}-01`)).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "heute", "morgen", "in 19 Tagen", "vor 3 Tagen" */
export function inTagen(iso: string, heuteIso: string): string {
  const n = tageZwischen(heuteIso, iso);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}

/** "17.06.2027" aus "2027-06-17" */
export function datumNumerisch(iso: string): string {
  const [j, m, t] = iso.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

/** Teile eines Datums für die Übersicht: Tag "23", Wochentag "Mo.", Monat "Nov.". */
export function datumTeile(iso: string): { tag: string; wochentag: string; monat: string } {
  const teile = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    weekday: "short",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(new Date(alsUtcTag(iso)));
  const hole = (typ: string) => teile.find((t) => t.type === typ)?.value ?? "";
  return { tag: hole("day"), wochentag: hole("weekday"), monat: hole("month") };
}

/** Anfangsbuchstaben für ein Namensschild, zum Beispiel "MB" für "Mia Becker". */
export function kuerzel(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return "?";
  const erster = teile[0][0] ?? "";
  const letzter = teile.length > 1 ? teile[teile.length - 1][0] : "";
  return (erster + letzter).toUpperCase();
}

