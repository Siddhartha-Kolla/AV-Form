"use client";

import { useRef } from "react";
import { dateiGroesse, ERLAUBTE_ENDUNGEN } from "@/lib/registration";
import { FieldError } from "@/components/fields";

export function FileSlot({
  id,
  label,
  hint,
  fuer,
  file,
  error,
  onSelect,
}: {
  id: string;
  label: string;
  hint: string;
  fuer: string;
  file: File | null;
  error?: string;
  onSelect: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const describedBy = [`${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        <span className="ml-2 font-normal text-muted-foreground">für {fuer}</span>
      </label>
      <p id={`${id}-hint`} className="mt-1 mb-2.5 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
        {hint}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id={id}
          name={id}
          type="file"
          accept={ERLAUBTE_ENDUNGEN.map((e) => `.${e}`).join(",")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          className="block max-w-full text-sm text-muted-foreground file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-background file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:border-foreground/60 aria-[invalid=true]:file:border-destructive"
        />
        {file && (
          <span className="flex items-center gap-3 text-sm">
            <span>
              {file.name}
              <span className="ml-1.5 text-muted-foreground">{dateiGroesse(file.size)}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                if (input.current) input.current.value = "";
                onSelect(null);
              }}
              className="rounded-sm text-sm text-foreground underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground"
            >
              Entfernen
            </button>
          </span>
        )}
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
