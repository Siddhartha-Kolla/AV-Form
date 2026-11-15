"use client";

import { useEffect, useRef, useState } from "react";
import { holeDatei } from "./datei";
import { useZoom, ZoomFuss } from "./zoom";

function Hinweis({ text, fehler = false }: { text: string; fehler?: boolean }) {
  return (
    <div className="grid h-full place-items-center bg-muted p-8 text-center">
      <p role={fehler ? "alert" : "status"} className={fehler ? "max-w-sm text-[15px] leading-relaxed" : "text-sm text-muted-foreground"}>
        {text}
      </p>
    </div>
  );
}

type Laden<T> = { status: "laedt" } | { status: "fertig"; daten: T } | { status: "fehler"; text: string };

function useBlob(url: string): Laden<Blob> {
  const [zustand, setZustand] = useState<Laden<Blob>>({ status: "laedt" });
  useEffect(() => {
    const abbruch = new AbortController();
    holeDatei(url, abbruch.signal)
      .then((blob) => setZustand({ status: "fertig", daten: blob }))
      .catch((fehler: Error) => {
        if (fehler.name !== "AbortError") setZustand({ status: "fehler", text: fehler.message });
      });
    return () => abbruch.abort();
  }, [url]);
  return zustand;
}

/* Word ------------------------------------------------------------------- */

/**
 * Word-Seiten haben eine feste Breite (A4 sind rund 800 Pixel). Auf schmalen Bildschirmen wird die Seite
 * deshalb zuerst auf die Breite des Fensters verkleinert ("passt") und lässt sich von dort heran- und
 * herauszoomen. Auf breiten Bildschirmen bleibt sie in Originalgröße.
 */
export function DocxAnsicht({ url }: { url: string }) {
  const blob = useBlob(url);
  const ziel = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState<HTMLDivElement | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [natuerlich, setNatuerlich] = useState(0); // Breite der Seite samt Rand in Pixeln, bei Zoom 1
  const [breite, setBreite] = useState(0);
  const { zoom, groesser, kleiner, zurueck } = useZoom(scroll);

  useEffect(() => {
    if (blob.status !== "fertig" || !ziel.current) return;
    const container = ziel.current;
    let abgebrochen = false;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (abgebrochen) return;
        container.replaceChildren();
        await renderAsync(blob.daten, container, undefined, {
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: false,
          renderFooters: false,
          renderFootnotes: true,
        });
        // Links aus Fremddokumenten nie in diesem Fenster öffnen und keine Skript-Adressen zulassen.
        for (const a of container.querySelectorAll("a")) {
          const href = a.getAttribute("href") ?? "";
          if (/^\s*javascript:/i.test(href)) a.removeAttribute("href");
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        }
        setNatuerlich(container.getBoundingClientRect().width);
      } catch {
        if (!abgebrochen) setFehler("Dieses Word-Dokument lässt sich hier nicht anzeigen. Du kannst es herunterladen.");
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [blob]);

  useEffect(() => {
    if (!scroll) return;
    const messen = () => setBreite(scroll.clientWidth);
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(scroll);
    return () => beobachter.disconnect();
  }, [scroll]);

  if (blob.status === "laedt") return <Hinweis text="Wird geladen" />;
  if (blob.status === "fehler") return <Hinweis text={blob.text} fehler />;
  if (fehler) return <Hinweis text={fehler} fehler />;

  const passt = natuerlich > 0 && breite > 0 ? Math.min(1, breite / natuerlich) : 1;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={setScroll}
        tabIndex={0}
        aria-label="Word-Dokument. Mit Pinch, Strg plus Mausrad oder den Tasten Plus und Minus zoomen."
        className="touch-pan-x touch-pan-y min-h-0 flex-1 overflow-auto bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/40"
      >
        {/* CSS-zoom ändert die Größe im Layout, deshalb wächst der Bildlaufbereich mit */}
        <div ref={ziel} className="docx-vorschau" style={{ zoom: passt * zoom, visibility: natuerlich ? "visible" : "hidden" }} />
      </div>
      <ZoomFuss links={passt < 1 && Math.abs(zoom - 1) < 0.01 ? "An die Breite angepasst" : undefined} zoom={zoom} groesser={groesser} kleiner={kleiner} zurueck={zurueck} />
    </div>
  );
}

/* Text ------------------------------------------------------------------- */

const MAX_ZEICHEN = 200_000;

export function TextAnsicht({ url }: { url: string }) {
  const blob = useBlob(url);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (blob.status !== "fertig") return;
    let aktuell = true;
    blob.daten.text().then((t) => aktuell && setText(t));
    return () => {
      aktuell = false;
    };
  }, [blob]);

  if (blob.status === "laedt" || (blob.status === "fertig" && text === null)) return <Hinweis text="Wird geladen" />;
  if (blob.status === "fehler") return <Hinweis text={blob.text} fehler />;
  const gekuerzt = (text ?? "").length > MAX_ZEICHEN;
  return (
    <div className="h-full overflow-auto bg-muted p-4">
      <pre className="mx-auto max-w-[46rem] whitespace-pre-wrap break-words rounded-sm bg-white p-6 font-sans text-[15px] leading-relaxed shadow-[0_1px_3px_rgb(0_0_0/0.12)]">
        {(text ?? "").slice(0, MAX_ZEICHEN)}
      </pre>
      {gekuerzt && (
        <p className="mx-auto mt-3 max-w-[46rem] text-sm text-muted-foreground">
          Die Vorschau zeigt nur den Anfang. Den Rest siehst du nach dem Herunterladen.
        </p>
      )}
    </div>
  );
}

/* Audio ------------------------------------------------------------------ */

export function AudioAnsicht({ url, name }: { url: string; name: string }) {
  const [zustand, setZustand] = useState<Laden<string>>({ status: "laedt" });

  useEffect(() => {
    const abbruch = new AbortController();
    let adresse: string | null = null;
    holeDatei(url, abbruch.signal)
      .then((blob) => {
        adresse = URL.createObjectURL(blob);
        setZustand({ status: "fertig", daten: adresse });
      })
      .catch((fehler: Error) => {
        if (fehler.name !== "AbortError") setZustand({ status: "fehler", text: fehler.message });
      });
    return () => {
      abbruch.abort();
      if (adresse) URL.revokeObjectURL(adresse);
    };
  }, [url]);

  if (zustand.status === "laedt") return <Hinweis text="Wird geladen" />;
  if (zustand.status === "fehler") return <Hinweis text={zustand.text} fehler />;
  return (
    <div className="grid h-full place-items-center bg-muted p-6">
      <div className="w-full max-w-md">
        <p className="mb-3 break-all text-center text-[15px] font-medium">{name}</p>
        <audio controls src={zustand.daten} className="w-full" preload="metadata" />
      </div>
    </div>
  );
}
