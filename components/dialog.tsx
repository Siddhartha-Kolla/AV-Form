"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Dialog auf Basis des eingebauten dialog-Elements. Der Browser kümmert sich um Fokusfalle,
 * Escape und den Hintergrund. Der Inhalt bleibt im DOM, damit Formularzustand erhalten bleibt.
 */
export function Dialog({
  titel,
  beschreibung,
  knopf,
  knopfVariante = "outline",
  knopfClassName,
  children,
}: {
  titel: string;
  beschreibung?: string;
  knopf: ReactNode;
  knopfVariante?: "default" | "outline" | "ghost";
  knopfClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  return (
    <>
      <Button
        type="button"
        variant={knopfVariante}
        className={cn("h-9 border-input bg-surface shadow-none", knopfVariante === "default" && "border-transparent bg-primary", knopfClassName)}
        onClick={() => ref.current?.showModal()}
      >
        {knopf}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-titel`}
        aria-describedby={beschreibung ? `${id}-text` : undefined}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_12px_40px_rgb(0_0_0/0.14)] backdrop:bg-foreground/35"
      >
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id={`${id}-titel`} className="text-lg font-semibold tracking-tight">
                {titel}
              </h2>
              {beschreibung && (
                <p id={`${id}-text`} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {beschreibung}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Schließen"
              className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
