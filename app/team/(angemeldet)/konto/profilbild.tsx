"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { BILD_KANTE, MAX_BILD_BYTES } from "@/lib/konto-bild";
import { bildEntfernenAktion, bildSpeichernAktion } from "./actions";

/** Größte Datei, die wir überhaupt zu lesen versuchen. Handyfotos sind oft mehrere Megabyte groß. */
const MAX_QUELLE_BYTES = 20_000_000;

/** Schneidet die Mitte des Bildes quadratisch aus und verkleinert es. Das spart Platz und entfernt Metadaten wie den Aufnahmeort. */
async function zuQuadrat(datei: File): Promise<Blob> {
  const bild = await createImageBitmap(datei);
  try {
    const leinwand = document.createElement("canvas");
    leinwand.width = leinwand.height = BILD_KANTE;
    const zeichner = leinwand.getContext("2d");
    if (!zeichner) throw new Error("Keine Zeichenfläche.");
    // JPEG kennt keine Transparenz. Ohne Hintergrund würden durchsichtige PNGs schwarz.
    zeichner.fillStyle = "#ffffff";
    zeichner.fillRect(0, 0, BILD_KANTE, BILD_KANTE);
    zeichner.imageSmoothingQuality = "high";
    const kante = Math.min(bild.width, bild.height);
    zeichner.drawImage(bild, (bild.width - kante) / 2, (bild.height - kante) / 2, kante, kante, 0, 0, BILD_KANTE, BILD_KANTE);
    for (const qualitaet of [0.9, 0.75, 0.55]) {
      const blob = await new Promise<Blob | null>((fertig) => leinwand.toBlob(fertig, "image/jpeg", qualitaet));
      if (blob && blob.size <= MAX_BILD_BYTES) return blob;
    }
    throw new Error("Das Ergebnis ist zu groß.");
  } finally {
    bild.close();
  }
}

/** Profilbild ändern: auswählen, Vorschau sehen, übernehmen. Das Bild wird im Browser zugeschnitten. */
export function ProfilBild({ id, name, version }: { id: string; name: string; version: string | null }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [vorschau, setVorschau] = useState<{ url: string; blob: Blob } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  // Die Adresse der Vorschau gibt der Browser frei, sobald sie nicht mehr gebraucht wird.
  useEffect(() => {
    const url = vorschau?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [vorschau]);

  async function gewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    e.target.value = "";
    if (!datei) return;
    setFehler(null);
    setMeldung(null);
    if (!datei.type.startsWith("image/")) return setFehler("Das ist keine Bilddatei.");
    if (datei.size > MAX_QUELLE_BYTES) return setFehler("Diese Datei ist zu groß. Bitte wähle ein Bild unter 20 MB.");
    try {
      const blob = await zuQuadrat(datei);
      setVorschau({ url: URL.createObjectURL(blob), blob });
    } catch {
      setFehler("Dieses Bild lässt sich nicht lesen. Probiere ein JPEG-, PNG- oder WebP-Bild.");
    }
  }

  function uebernehmen() {
    if (!vorschau) return;
    const daten = new FormData();
    daten.append("bild", vorschau.blob, "profilbild.jpg");
    setFehler(null);
    starte(async () => {
      const antwort = await bildSpeichernAktion(daten);
      if (antwort.ok) {
        setVorschau(null);
        setMeldung(antwort.meldung ?? null);
      } else {
        setFehler(antwort.fehler ?? "Das hat nicht geklappt.");
      }
    });
  }

  function entfernen() {
    setFehler(null);
    starte(async () => {
      const antwort = await bildEntfernenAktion();
      setMeldung(antwort.meldung ?? null);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      {vorschau ? (
        // Eine lokale Vorschau, noch nicht gespeichert.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vorschau.url} alt="Vorschau des neuen Profilbilds" className="size-24 shrink-0 rounded-full object-cover ring-1 ring-inset ring-border" />
      ) : (
        <Avatar id={id} name={name} version={version} className="size-24 text-2xl" />
      )}

      <div className="min-w-0">
        <input ref={eingabe} type="file" accept="image/jpeg,image/png,image/webp" onChange={gewaehlt} className="sr-only" tabIndex={-1} aria-label="Bilddatei auswählen" />
        {vorschau ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={uebernehmen} disabled={laeuft} className="h-10 px-4 text-[15px]">
              {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Übernehmen
            </Button>
            <Button type="button" variant="ghost" onClick={() => setVorschau(null)} disabled={laeuft} className="h-10 px-3 text-[15px]">
              Abbrechen
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => eingabe.current?.click()} disabled={laeuft} className="h-10 gap-2 border-input bg-surface px-4 text-[15px] shadow-none">
              <ImagePlus className="size-4" aria-hidden="true" />
              {version ? "Bild ändern" : "Bild hinzufügen"}
            </Button>
            {version && (
              <Button type="button" variant="ghost" onClick={entfernen} disabled={laeuft} className="h-10 px-3 text-[15px] text-muted-foreground">
                {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Entfernen
              </Button>
            )}
          </div>
        )}
        <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
          {vorschau
            ? "So sieht das Team dein Bild. Es wird quadratisch aus der Mitte zugeschnitten."
            : "JPEG, PNG oder WebP. Das Team sieht dein Bild in der Kopfleiste und in der Mitgliederliste."}
        </p>
        {fehler && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {fehler}
          </p>
        )}
        {meldung && !fehler && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {meldung}
          </p>
        )}
      </div>
    </div>
  );
}
