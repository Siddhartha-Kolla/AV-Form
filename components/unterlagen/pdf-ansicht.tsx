"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { holeDatei } from "./datei";

type Zustand =
  | { status: "laedt" }
  | { status: "fertig"; pdf: PDFDocumentProxy; seiten: number; verhaeltnis: number }
  | { status: "fehler"; text: string };

/**
 * PDF-Vorschau mit pdf.js. Die Seiten werden auf Canvas gezeichnet und erst gerendert, wenn sie ins Bild
 * kommen. Das PDF läuft nie im Browser-Viewer, deshalb kann es keine Skripte ausführen.
 * pdf.js wird erst beim ersten Öffnen einer PDF-Datei geladen, die Worker-Datei kommt vom eigenen Server.
 */
export function PdfAnsicht({ url }: { url: string }) {
  const [zustand, setZustand] = useState<Zustand>({ status: "laedt" });
  const [aktuell, setAktuell] = useState(1);
  const [breite, setBreite] = useState(0);
  const [scroll, setScroll] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const abbruch = new AbortController();
    let geladen: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const [pdfjs, blob] = await Promise.all([import("pdfjs-dist"), holeDatei(url, abbruch.signal)]);
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const daten = new Uint8Array(await blob.arrayBuffer());
        geladen = await pdfjs.getDocument({ data: daten, isEvalSupported: false }).promise;
        const erste = await geladen.getPage(1);
        const ansicht = erste.getViewport({ scale: 1 });
        setZustand({ status: "fertig", pdf: geladen, seiten: geladen.numPages, verhaeltnis: ansicht.height / ansicht.width });
      } catch (fehler) {
        if ((fehler as Error).name === "AbortError") return;
        const name = (fehler as Error).name;
        setZustand({
          status: "fehler",
          text:
            name === "PasswordException"
              ? "Dieses PDF ist passwortgeschützt. Lade es herunter, um es zu öffnen."
              : (fehler as Error).message.includes("geladen") || (fehler as Error).message.includes("Sitzung")
                ? (fehler as Error).message
                : "Dieses PDF lässt sich hier nicht anzeigen. Du kannst es herunterladen.",
        });
      }
    })();
    return () => {
      abbruch.abort();
      void geladen?.destroy();
    };
  }, [url]);

  // Der Scrollbereich entsteht erst, wenn das PDF geladen ist, deshalb als Zustand statt als useRef.
  useEffect(() => {
    if (!scroll) return;
    const messen = () => setBreite(Math.floor(scroll.clientWidth));
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(scroll);
    return () => beobachter.disconnect();
  }, [scroll]);

  if (zustand.status === "laedt") return <Hinweis text="Wird geladen" />;
  if (zustand.status === "fehler") return <Hinweis text={zustand.text} fehler />;

  const seitenBreite = Math.max(0, Math.min(breite - 32, 820));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={setScroll} className="min-h-0 flex-1 overflow-auto bg-muted px-4 py-4">
        <div className="mx-auto flex flex-col gap-4" style={{ width: seitenBreite || undefined }}>
          {seitenBreite > 0 &&
            Array.from({ length: zustand.seiten }, (_, i) => (
              <Seite
                key={`${i}-${Math.round(seitenBreite / 40)}`}
                pdf={zustand.pdf}
                nummer={i + 1}
                breite={seitenBreite}
                verhaeltnis={zustand.verhaeltnis}
                root={scroll}
                onSichtbar={setAktuell}
              />
            ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-2.5 text-sm text-muted-foreground" aria-live="polite">
        <span>
          Seite {aktuell} von {zustand.seiten}
        </span>
        <span className="hidden sm:inline">Zum Blättern scrollen</span>
      </div>
    </div>
  );
}

function Seite({
  pdf,
  nummer,
  breite,
  verhaeltnis,
  root,
  onSichtbar,
}: {
  pdf: PDFDocumentProxy;
  nummer: number;
  breite: number;
  verhaeltnis: number;
  root: HTMLDivElement | null;
  onSichtbar: (nummer: number) => void;
}) {
  const rahmen = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sichtbar, setSichtbar] = useState(nummer <= 2);
  const gezeichnet = useRef(false);

  useEffect(() => {
    const el = rahmen.current;
    if (!el) return;
    const nah = new IntersectionObserver((e) => e[0].isIntersecting && setSichtbar(true), {
      root,
      rootMargin: "900px 0px",
    });
    const mitte = new IntersectionObserver((e) => e[0].isIntersecting && onSichtbar(nummer), {
      root,
      rootMargin: "-45% 0px -45% 0px",
    });
    nah.observe(el);
    mitte.observe(el);
    return () => {
      nah.disconnect();
      mitte.disconnect();
    };
  }, [root, nummer, onSichtbar]);

  useEffect(() => {
    if (!sichtbar || gezeichnet.current || !canvas.current) return;
    let aufgabe: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let abgebrochen = false;
    (async () => {
      const seite = await pdf.getPage(nummer);
      if (abgebrochen || !canvas.current) return;
      const basis = seite.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ansicht = seite.getViewport({ scale: (breite / basis.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(ansicht.width);
      c.height = Math.floor(ansicht.height);
      const kontext = c.getContext("2d");
      if (!kontext) return;
      aufgabe = seite.render({ canvasContext: kontext, viewport: ansicht });
      try {
        await aufgabe.promise;
        gezeichnet.current = true;
      } catch {
        // Beim Schließen oder Neuzeichnen abgebrochen.
      }
    })();
    return () => {
      abgebrochen = true;
      aufgabe?.cancel();
    };
  }, [sichtbar, pdf, nummer, breite]);

  return (
    <div
      ref={rahmen}
      className="overflow-hidden rounded-sm bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
      style={{ width: breite, height: Math.round(breite * verhaeltnis) }}
      aria-label={`Seite ${nummer}`}
    >
      <canvas ref={canvas} className="block h-full w-full" aria-hidden="true" />
    </div>
  );
}

function Hinweis({ text, fehler = false }: { text: string; fehler?: boolean }) {
  return (
    <div className="grid h-full place-items-center bg-muted p-8 text-center">
      <p role={fehler ? "alert" : "status"} className={fehler ? "max-w-sm text-[15px] leading-relaxed" : "text-sm text-muted-foreground"}>
        {text}
      </p>
    </div>
  );
}
