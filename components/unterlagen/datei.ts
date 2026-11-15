/** Was sich im Browser anzeigen lässt, ohne dass die Datei heruntergeladen werden muss. */
export type DateiArt = "pdf" | "docx" | "text" | "audio" | "praesentation" | "andere";

export function dateiArt(name: string): DateiArt {
  const endung = name.split(".").pop()?.toLowerCase() ?? "";
  if (endung === "pdf") return "pdf";
  if (endung === "docx") return "docx";
  if (endung === "txt") return "text";
  if (endung === "mp3" || endung === "wav") return "audio";
  if (endung === "pptx") return "praesentation";
  return "andere";
}

export function hatVorschau(art: DateiArt): boolean {
  return art === "pdf" || art === "docx" || art === "text" || art === "audio";
}

export function artText(art: DateiArt, name: string): string {
  const endung = name.split(".").pop()?.toUpperCase() ?? "";
  switch (art) {
    case "pdf":
      return "PDF-Dokument";
    case "docx":
      return "Word-Dokument";
    case "text":
      return "Textdatei";
    case "audio":
      return `Audiodatei (${endung})`;
    case "praesentation":
      return "PowerPoint-Präsentation";
    default:
      return endung ? `${endung}-Datei` : "Datei";
  }
}

export function dateiUrl(anmeldungId: string, dateiId: string, vorschau = false): string {
  return `/team/dateien/${anmeldungId}/${dateiId}${vorschau ? "?vorschau=1" : ""}`;
}

/** Holt eine Datei für die Vorschau. Fehlertexte sind für Menschen gedacht. */
export async function holeDatei(url: string, signal: AbortSignal): Promise<Blob> {
  let antwort: Response;
  try {
    antwort = await fetch(url, { signal, credentials: "same-origin" });
  } catch (fehler) {
    if ((fehler as Error).name === "AbortError") throw fehler;
    throw new Error("Die Datei konnte nicht geladen werden. Prüfe die Verbindung.");
  }
  if (antwort.status === 401) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich neu an.");
  if (!antwort.ok) throw new Error("Die Datei konnte nicht geladen werden.");
  return antwort.blob();
}
