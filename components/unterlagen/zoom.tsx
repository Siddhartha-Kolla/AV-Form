"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

const begrenzt = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

type Fokus = { x: number; y: number };

/**
 * Zoom für einen scrollbaren Bereich. 1 bedeutet "passt in die Breite".
 * Bedient wird er mit dem Pinch-Griff auf dem Touchpad (Browser melden ihn als Strg plus Mausrad),
 * mit zwei Fingern auf dem Handy, mit Strg plus Mausrad, mit den Tasten + - 0 und mit den Knöpfen.
 * Beim Zoomen bleibt die Stelle unter den Fingern oder dem Mauszeiger an ihrem Platz.
 */
export function useZoom(bereich: HTMLElement | null) {
  const [zoom, setZoomZustand] = useState(1);
  const aktuell = useRef(1);
  const ausstehend = useRef<{ faktor: number; cx: number; cy: number } | null>(null);
  const element = useRef<HTMLElement | null>(null);
  useEffect(() => {
    element.current = bereich;
  }, [bereich]);

  const setZoom = useCallback(
    (ziel: number, fokus?: Fokus) => {
      const neu = begrenzt(ziel);
      const alt = aktuell.current;
      if (Math.abs(neu - alt) < 0.001) return;
      const rahmen = bereich?.getBoundingClientRect();
      const cx = fokus && rahmen ? fokus.x - rahmen.left : (bereich?.clientWidth ?? 0) / 2;
      const cy = fokus && rahmen ? fokus.y - rahmen.top : (bereich?.clientHeight ?? 0) / 2;
      const faktor = neu / alt;
      // Mehrere Ereignisse vor dem nächsten Zeichnen werden zusammengezählt.
      ausstehend.current = ausstehend.current
        ? { faktor: ausstehend.current.faktor * faktor, cx, cy }
        : { faktor, cx, cy };
      aktuell.current = neu;
      setZoomZustand(neu);
    },
    [bereich],
  );

  // Nach dem Neuberechnen des Layouts die Bildlaufposition so setzen, dass der Fokus stehen bleibt.
  useLayoutEffect(() => {
    const p = ausstehend.current;
    const el = element.current;
    if (!p || !el) return;
    ausstehend.current = null;
    el.scrollLeft = (el.scrollLeft + p.cx) * p.faktor - p.cx;
    el.scrollTop = (el.scrollTop + p.cy) * p.faktor - p.cy;
  }, [zoom]);

  useEffect(() => {
    if (!bereich) return;

    // Touchpad-Pinch und Strg plus Mausrad
    const rad = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = Math.max(-25, Math.min(25, e.deltaY));
      setZoom(aktuell.current * Math.exp(-delta * 0.012), { x: e.clientX, y: e.clientY });
    };

    // Zwei Finger auf dem Handy
    let start: { abstand: number; zoom: number } | null = null;
    const abstand = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { abstand: abstand(e.touches), zoom: aktuell.current };
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start || start.abstand === 0) return;
      e.preventDefault();
      setZoom(start.zoom * (abstand(e.touches) / start.abstand), {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      });
    };
    const touchEnde = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };

    // Safari auf dem Mac meldet den Pinch als eigene Gesten-Ereignisse
    let gestenStart = 1;
    type GestenEreignis = Event & { scale: number; clientX: number; clientY: number };
    const gestenAnfang = (e: Event) => {
      e.preventDefault();
      gestenStart = aktuell.current;
    };
    const gestenAenderung = (e: Event) => {
      e.preventDefault();
      const g = e as GestenEreignis;
      setZoom(gestenStart * g.scale, { x: g.clientX, y: g.clientY });
    };

    const taste = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") setZoom(aktuell.current * 1.25);
      else if (e.key === "-") setZoom(aktuell.current / 1.25);
      else if (e.key === "0") setZoom(1);
      else return;
      e.preventDefault();
    };

    bereich.addEventListener("wheel", rad, { passive: false });
    bereich.addEventListener("touchstart", touchStart, { passive: true });
    bereich.addEventListener("touchmove", touchMove, { passive: false });
    bereich.addEventListener("touchend", touchEnde, { passive: true });
    bereich.addEventListener("touchcancel", touchEnde, { passive: true });
    bereich.addEventListener("gesturestart", gestenAnfang);
    bereich.addEventListener("gesturechange", gestenAenderung);
    bereich.addEventListener("keydown", taste);
    return () => {
      bereich.removeEventListener("wheel", rad);
      bereich.removeEventListener("touchstart", touchStart);
      bereich.removeEventListener("touchmove", touchMove);
      bereich.removeEventListener("touchend", touchEnde);
      bereich.removeEventListener("touchcancel", touchEnde);
      bereich.removeEventListener("gesturestart", gestenAnfang);
      bereich.removeEventListener("gesturechange", gestenAenderung);
      bereich.removeEventListener("keydown", taste);
    };
  }, [bereich, setZoom]);

  return {
    zoom,
    setZoom,
    groesser: () => setZoom(aktuell.current * 1.25),
    kleiner: () => setZoom(aktuell.current / 1.25),
    zurueck: () => setZoom(1),
  };
}

/** Fußleiste unter dem Dokument: links Infos, rechts die Zoom-Knöpfe. */
export function ZoomFuss({
  links,
  zoom,
  groesser,
  kleiner,
  zurueck,
}: {
  links?: React.ReactNode;
  zoom: number;
  groesser: () => void;
  kleiner: () => void;
  zurueck: () => void;
}) {
  const knopf =
    "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground sm:px-5">
      <span aria-live="polite">{links}</span>
      <div className="flex items-center" role="group" aria-label="Zoom">
        <button type="button" onClick={kleiner} disabled={zoom <= ZOOM_MIN + 0.001} aria-label="Verkleinern" className={knopf}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={zurueck}
          aria-label="Auf Seitenbreite zurücksetzen"
          title="Auf Seitenbreite zurücksetzen"
          className="min-w-14 rounded-md px-2 py-1.5 text-center tabular-nums transition-colors hover:bg-muted hover:text-foreground"
        >
          {Math.round(zoom * 100)} %
        </button>
        <button type="button" onClick={groesser} disabled={zoom >= ZOOM_MAX - 0.001} aria-label="Vergrößern" className={knopf}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
