"use client";

import { useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ERLAUBTE_ENDUNGEN,
  MAX_DATEIEN,
  MAX_DATEI_MB,
  dateiGroesse,
  pruefeDatei,
} from "@/lib/registration";

export function FileDrop({
  files,
  onChange,
  maximal = MAX_DATEIEN,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  /** Wie viele Dateien insgesamt noch dazukommen dürfen. */
  maximal?: number;
}) {
  const [drag, setDrag] = useState(false);
  const [abgelehnt, setAbgelehnt] = useState<string[]>([]);

  function hinzufuegen(neu: FileList | null) {
    if (!neu || neu.length === 0) return;
    const probleme: string[] = [];
    const next = [...files];
    for (const f of Array.from(neu)) {
      const problem = pruefeDatei(f);
      if (problem) probleme.push(`${f.name}: ${problem}`);
      else if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      else if (next.length >= maximal) probleme.push(`${f.name}: Es sind höchstens ${MAX_DATEIEN} Dateien insgesamt möglich.`);
      else next.push(f);
    }
    setAbgelehnt(probleme);
    onChange(next);
  }

  return (
    <div>
      <div className="relative">
        <input
          id="dateien"
          name="dateien"
          type="file"
          multiple
          accept={ERLAUBTE_ENDUNGEN.map((e) => `.${e}`).join(",")}
          aria-describedby="dateien-hinweis"
          className="peer sr-only"
          onChange={(e) => {
            hinzufuegen(e.target.files);
            e.target.value = "";
          }}
        />
        <label
          htmlFor="dateien"
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            hinzufuegen(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-surface px-6 py-10 text-center transition-colors duration-150 hover:border-foreground/50 hover:bg-muted/60 peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/25",
            drag && "border-ring bg-ring/10",
          )}
        >
          <Upload className="mb-2 size-6 text-muted-foreground" aria-hidden="true" strokeWidth={1.5} />
          <span className="text-[15px] font-medium">
            Dateien hierher ziehen oder <span className="text-primary underline underline-offset-4">auswählen</span>
          </span>
          <span id="dateien-hinweis" className="text-sm text-muted-foreground">
            PDF, Word, PowerPoint, ODT, TXT, MP3 oder WAV, bis {MAX_DATEI_MB} MB je Datei
          </span>
        </label>
      </div>

      {abgelehnt.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 text-sm text-destructive">
          {abgelehnt.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" strokeWidth={1.5} />
              <span className="min-w-0 flex-1 truncate text-[15px]">{f.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">{dateiGroesse(f.size)}</span>
              <button
                type="button"
                onClick={() => {
                  setAbgelehnt([]);
                  onChange(files.filter((x) => x !== f));
                }}
                aria-label={`${f.name} entfernen`}
                className="-mr-1.5 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
