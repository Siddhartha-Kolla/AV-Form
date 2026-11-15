"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/dialog";
import { Section, TextArea } from "@/components/fields";
import { FileDrop } from "@/components/file-drop";
import { FormularAbschnitte, useFormular } from "@/components/formular-abschnitte";
import { datumNumerisch } from "@/lib/format";
import { feldBezeichnung, geaenderteFelder } from "@/lib/dashboard";
import { MAX_DATEIEN, dateiGroesse, validate, type FormValues } from "@/lib/registration";
import { cn } from "@/lib/utils";

type BestehendeDatei = { id: string; name: string; groesse: number; erstelltAm: string };
type Status = "ruhig" | "speichert" | "fehler";

/**
 * Bearbeitung einer Anmeldung durch das Team: dieselben Felder wie im Formular der Lehrkräfte, dazu Dateien
 * entfernen und hinzufügen und ein Vermerk, woher die Änderung kommt. Gespeichert wird alles zusammen.
 */
export function AnmeldungBearbeiten({
  id,
  revision,
  start,
  dateien,
}: {
  id: string;
  revision: number;
  start: FormValues;
  dateien: BestehendeDatei[];
}) {
  const router = useRouter();
  const formular = useFormular(start);
  const { values } = formular;
  const [neueDateien, setNeueDateien] = useState<File[]>([]);
  const [entfernen, setEntfernen] = useState<string[]>([]);
  const [notiz, setNotiz] = useState("");
  const [angeklickt, setAngeklickt] = useState<Record<string, boolean>>({});
  const [abgesendet, setAbgesendet] = useState(false);
  const [status, setStatus] = useState<Status>("ruhig");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [serverFehler, setServerFehler] = useState<Record<string, string>>({});
  const [dateiFehler, setDateiFehler] = useState<string[]>([]);
  const zusammenfassung = useRef<HTMLDivElement>(null);

  const clientFehler = useMemo(() => validate(values, null), [values]);
  const fehler = (key: string) => serverFehler[key] ?? (abgesendet || angeklickt[key] ? clientFehler[key] : undefined);
  const alleFehler = { ...clientFehler, ...serverFehler };

  const geaendert = useMemo(() => geaenderteFelder(start, values), [start, values]);
  const anzahl = geaendert.length + (neueDateien.length > 0 ? 1 : 0) + (entfernen.length > 0 ? 1 : 0);
  const beschreibung = [
    ...geaendert.map(feldBezeichnung),
    ...(neueDateien.length > 0 ? ["Datei hinzugefügt"] : []),
    ...(entfernen.length > 0 ? ["Datei entfernt"] : []),
  ];
  const veraendert = anzahl > 0;
  const speichert = status === "speichert";
  const verbleibend = MAX_DATEIEN - (dateien.length - entfernen.length);

  // Warnt, wenn die Seite mit ungespeicherten Änderungen geschlossen wird.
  useEffect(() => {
    if (!veraendert || speichert) return;
    const warnen = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [veraendert, speichert]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setAbgesendet(true);
    setMeldung(null);
    setDateiFehler([]);
    setServerFehler({});
    if (Object.keys(clientFehler).length > 0) {
      requestAnimationFrame(() => zusammenfassung.current?.focus());
      return;
    }

    setStatus("speichert");
    const daten = new FormData();
    daten.set("daten", JSON.stringify(values));
    daten.set("revision", String(revision));
    daten.set("notiz", notiz);
    daten.set("entfernen", JSON.stringify(entfernen));
    for (const d of neueDateien) daten.append("dateien", d);

    try {
      const antwort = await fetch(`/team/anmeldungen/${id}/speichern`, { method: "POST", body: daten });
      const ergebnis = (await antwort.json()) as {
        ok: boolean;
        meldung?: string;
        fehler?: Record<string, string>;
        dateiFehler?: string[];
      };
      if (ergebnis.ok) {
        router.push(`/team/anmeldungen/${id}`);
        router.refresh();
        return;
      }
      setServerFehler(ergebnis.fehler ?? {});
      setDateiFehler(ergebnis.dateiFehler ?? []);
      setMeldung(ergebnis.meldung ?? (ergebnis.fehler || ergebnis.dateiFehler ? null : "Das Speichern hat nicht geklappt."));
      setStatus("fehler");
    } catch {
      setMeldung("Keine Verbindung zum Server. Deine Änderungen sind noch hier, bitte versuche es noch einmal.");
      setStatus("fehler");
    }
    requestAnimationFrame(() => zusammenfassung.current?.focus());
  }

  const fehlerListe = Object.entries(alleFehler);
  const zeigeFehlerBox = (abgesendet && fehlerListe.length > 0) || meldung || dateiFehler.length > 0;

  return (
    <form noValidate onSubmit={speichern} onBlur={(e) => {
      const name = (e.target as unknown as HTMLInputElement).name;
      if (name) setAngeklickt((t) => (t[name] ? t : { ...t, [name]: true }));
    }} aria-busy={speichert}>
      <Link
        href={`/team/anmeldungen/${id}`}
        className="-ml-1 mb-6 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Zur Anmeldung
      </Link>

      <header className="mb-10">
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Anmeldung bearbeiten</h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          Hier trägst du Änderungen ein, die zum Beispiel per E-Mail gekommen sind. Danach sehen alle im Team den neuen
          Stand und im Verlauf, wer was geändert hat.
        </p>
      </header>

      {zeigeFehlerBox && (
        <div ref={zusammenfassung} tabIndex={-1} role="alert" className="mb-10 rounded-md border border-destructive/40 px-4 py-3 outline-none">
          {meldung && <p className="font-medium text-destructive">{meldung}</p>}
          {dateiFehler.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm text-destructive">
              {dateiFehler.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {abgesendet && fehlerListe.length > 0 && (
            <>
              <p className="font-medium text-destructive">
                {fehlerListe.length === 1 ? "Ein Feld braucht noch eine Angabe." : `${fehlerListe.length} Felder brauchen noch eine Angabe.`}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-sm">
                {fehlerListe.map(([key, msg]) => (
                  <li key={key}>
                    <a
                      href={`#${key}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(key)?.focus();
                      }}
                      className="underline decoration-muted-foreground hover:decoration-foreground"
                    >
                      {msg}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <fieldset disabled={speichert} className="min-w-0">
        <legend className="sr-only">Anmeldung bearbeiten</legend>

        <FormularAbschnitte f={formular} fehler={fehler} />

        <Section id="unterlagen" nr="8" title="Unterlagen">
          {dateien.length > 0 && (
            <ul className="mb-5 divide-y divide-border border-y border-border">
              {dateien.map((d) => {
                const weg = entfernen.includes(d.id);
                return (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <FileText className={cn("size-5 shrink-0", weg ? "text-muted-foreground/60" : "text-muted-foreground")} strokeWidth={1.5} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className={cn("break-words text-[15px]", weg && "text-muted-foreground line-through")}>{d.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {weg ? "Wird beim Speichern entfernt" : `${dateiGroesse(d.groesse)}, hochgeladen am ${datumNumerisch(d.erstelltAm)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEntfernen((e) => (weg ? e.filter((x) => x !== d.id) : [...e, d.id]))}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-surface px-3 text-sm font-medium transition-colors hover:border-foreground/50"
                    >
                      {weg ? <Undo2 className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                      {weg ? "Behalten" : "Entfernen"}
                      <span className="sr-only">: {d.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mb-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Neue Dateien ziehst du einfach hierher. Sie werden mit dem Speichern hochgeladen.
          </p>
          <FileDrop files={neueDateien} onChange={setNeueDateien} maximal={Math.max(0, verbleibend)} />
        </Section>

        <Section id="vermerk" nr="9" title="Vermerk zur Änderung">
          <TextArea
            id="notiz"
            label="Woher kommt die Änderung? (optional)"
            hint="Zum Beispiel „per E-Mail von Frau Beispiel am 12.11.“ Der Vermerk steht im Verlauf der Anmeldung."
            value={notiz}
            maxLength={500}
            onChange={(e) => setNotiz(e.target.value)}
            className="max-w-xl"
          />
        </Section>
      </fieldset>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-5 mt-14 border-t border-border bg-surface px-5 py-3 sm:bottom-0 sm:-mx-10 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground" aria-live="polite">
            {veraendert ? (
              <>
                <span className="whitespace-nowrap font-medium text-foreground">{anzahl === 1 ? "1 Änderung" : `${anzahl} Änderungen`}</span>
                <span className="hidden sm:inline">: {beschreibung.slice(0, 4).join(", ")}{beschreibung.length > 4 ? " und mehr" : ""}</span>
              </>
            ) : (
              "Noch nichts geändert."
            )}
          </p>
          <div className="flex items-center gap-3">
            {veraendert ? (
              <Dialog
                titel="Änderungen verwerfen?"
                beschreibung="Alles, was du hier eingegeben hast, geht verloren."
                knopf="Abbrechen"
                knopfClassName="h-11 px-4 text-[15px]"
              >
                <Link
                  href={`/team/anmeldungen/${id}`}
                  className="inline-flex h-10 items-center rounded-md border border-destructive/40 px-4 text-[15px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Ja, verwerfen
                </Link>
              </Dialog>
            ) : (
              <Link
                href={`/team/anmeldungen/${id}`}
                className="inline-flex h-11 items-center rounded-md border border-input bg-surface px-4 text-[15px] font-medium transition-colors hover:border-foreground/50"
              >
                Zurück
              </Link>
            )}
            <Button type="submit" className="h-11 px-6 text-[15px]" disabled={speichert || !veraendert}>
              {speichert && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {speichert ? "Wird gespeichert" : "Speichern"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
