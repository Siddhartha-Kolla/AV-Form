"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, ChevronLeft, ChevronRight, Download, File, FileText, Presentation, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateiGroesse } from "@/lib/registration";
import { datumNumerisch } from "@/lib/format";
import { PdfAnsicht } from "./pdf-ansicht";
import { AudioAnsicht, DocxAnsicht, TextAnsicht } from "./weitere-ansichten";
import { artText, dateiArt, dateiUrl, hatVorschau, type DateiArt } from "./datei";

/** Ab dieser Breite ist neben der Seite Platz für die Vorschau. */
const BREIT = "(min-width: 1280px)";

export type UnterlagenDatei = { id: string; name: string; groesse: number; erstelltAm: string };

function Symbol({ art, className }: { art: DateiArt; className?: string }) {
  const props = { className: cn("size-5 shrink-0", className), "aria-hidden": true, strokeWidth: 1.5 } as const;
  if (art === "audio") return <AudioLines {...props} />;
  if (art === "praesentation") return <Presentation {...props} />;
  if (art === "pdf" || art === "docx" || art === "text") return <FileText {...props} />;
  return <File {...props} />;
}

/**
 * Die Unterlagen einer Anmeldung. Ein Klick öffnet die Datei in einem Fenster am rechten Rand, in dem
 * sich PDF, Word, Text und Audio direkt ansehen lassen. Mit den Pfeilen oder den Pfeiltasten geht es
 * zur nächsten Datei. Herunterladen ist immer möglich, auch bei Dateien ohne Vorschau.
 */
export function Unterlagen({ anmeldungId, dateien }: { anmeldungId: string; dateien: UnterlagenDatei[] }) {
  const [offen, setOffen] = useState<number | null>(null);
  // Auf breiten Bildschirmen steht die Vorschau neben der Seite und schiebt sie zur Seite, auf schmalen liegt sie darüber.
  const [angedockt, setAngedockt] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const zurueck = useRef<HTMLElement | null>(null);
  const istOffen = offen !== null;

  const oeffnen = useCallback((index: number) => {
    if (!dialog.current?.open) {
      zurueck.current = document.activeElement as HTMLElement | null;
      setAngedockt(window.matchMedia(BREIT).matches);
    }
    setOffen(index);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (offen !== null && !d.open) {
      if (angedockt) d.show();
      else d.showModal();
    }
    if (offen === null && d.open) d.close();
  }, [offen, angedockt]);

  // Angedockt braucht die Seite Platz: ein Attribut am Wurzelelement lässt das CSS den rechten Rand freihalten.
  useEffect(() => {
    if (!istOffen || !angedockt) return;
    document.documentElement.setAttribute("data-vorschau-offen", "");
    return () => document.documentElement.removeAttribute("data-vorschau-offen");
  }, [istOffen, angedockt]);

  const schliessen = useCallback(() => {
    setOffen(null);
    zurueck.current?.focus();
  }, []);

  // Ein nicht-modaler Dialog schließt nicht von selbst mit Escape.
  useEffect(() => {
    if (!istOffen || !angedockt) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [istOffen, angedockt, schliessen]);

  const weiter = useCallback(
    (schritt: number) => setOffen((i) => (i === null ? i : (i + schritt + dateien.length) % dateien.length)),
    [dateien.length],
  );

  const datei = offen === null ? null : dateien[offen];
  const art = datei ? dateiArt(datei.name) : "andere";

  return (
    <>
      <ul className="divide-y divide-border border-y border-border">
        {dateien.map((d, i) => {
          const a = dateiArt(d.name);
          return (
            <li key={d.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => oeffnen(i)}
                aria-label={`Vorschau öffnen: ${d.name}`}
                aria-current={offen === i ? "true" : undefined}
                className={cn(
                  "group -ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted",
                  offen === i && "bg-muted",
                )}
              >
                <Symbol art={a} className="text-muted-foreground group-hover:text-foreground" />
                <span className="min-w-0">
                  <span className="block break-words text-[15px] font-medium leading-snug">{d.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {artText(a, d.name)}, {dateiGroesse(d.groesse)}
                  </span>
                </span>
              </button>
              <a
                href={dateiUrl(anmeldungId, d.id)}
                aria-label={`Herunterladen: ${d.name}`}
                title="Herunterladen"
                className="-mr-2 grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download className="size-[18px]" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialog}
        className="drawer"
        data-angedockt={angedockt ? "" : undefined}
        aria-label={datei ? `Vorschau: ${datei.name}` : "Vorschau"}
        onClose={() => setOffen(null)}
        onClick={(e) => {
          if (!angedockt && e.target === dialog.current) schliessen();
        }}
        onKeyDown={(e) => {
          const ziel = e.target as HTMLElement;
          if (ziel.tagName === "AUDIO" || ziel.tagName === "INPUT") return;
          if (e.key === "ArrowRight") weiter(1);
          if (e.key === "ArrowLeft") weiter(-1);
        }}
      >
        {datei && (
          <div className="flex h-full flex-col">
            <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-4 py-3 sm:flex-nowrap sm:px-5">
              <Symbol art={art} className="text-muted-foreground" />
              <div className="order-1 min-w-0 flex-1 basis-[calc(100%-6rem)] sm:basis-0">
                <p className="truncate text-[15px] font-semibold">{datei.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {artText(art, datei.name)}, {dateiGroesse(datei.groesse)}, hochgeladen am {datumNumerisch(datei.erstelltAm)}
                </p>
              </div>
              {dateien.length > 1 && offen !== null && (
                <div className="order-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => weiter(-1)}
                    aria-label="Vorherige Datei"
                    className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <span className="min-w-12 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">
                    {offen + 1} von {dateien.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => weiter(1)}
                    aria-label="Nächste Datei"
                    className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </div>
              )}
              <a
                href={dateiUrl(anmeldungId, datei.id)}
                className="order-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-surface px-3 text-sm font-medium transition-colors hover:border-foreground/50"
              >
                <Download className="size-4" aria-hidden="true" />
                Herunterladen
              </a>
              <button
                type="button"
                onClick={schliessen}
                aria-label="Vorschau schließen"
                className="order-2 grid size-9 place-items-center rounded-md sm:order-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1">
              {/* key: beim Wechsel der Datei beginnt die Ansicht neu */}
              <Ansicht key={datei.id} art={art} url={dateiUrl(anmeldungId, datei.id, true)} datei={datei} anmeldungId={anmeldungId} />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

function Ansicht({
  art,
  url,
  datei,
  anmeldungId,
}: {
  art: DateiArt;
  url: string;
  datei: UnterlagenDatei;
  anmeldungId: string;
}) {
  if (art === "pdf") return <PdfAnsicht url={url} />;
  if (art === "docx") return <DocxAnsicht url={url} />;
  if (art === "text") return <TextAnsicht url={url} />;
  if (art === "audio") return <AudioAnsicht url={url} name={datei.name} />;
  return (
    <div className="grid h-full place-items-center bg-muted p-8 text-center">
      <div className="max-w-sm">
        <p className="text-[15px] font-medium">{hatVorschau(art) ? "" : "Für diesen Dateityp gibt es keine Vorschau."}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {art === "praesentation"
            ? "PowerPoint-Dateien öffnest du am besten in PowerPoint oder LibreOffice."
            : "Lade die Datei herunter, um sie zu öffnen."}
        </p>
        <a
          href={dateiUrl(anmeldungId, datei.id)}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Download className="size-4" aria-hidden="true" />
          Herunterladen
        </a>
      </div>
    </div>
  );
}
