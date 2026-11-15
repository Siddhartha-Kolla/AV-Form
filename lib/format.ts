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
