"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, CountField, FieldError, Section, TextArea, TextField } from "@/components/fields";
import { FileDrop } from "@/components/file-drop";
import { datumLang, sendeAnmeldung } from "@/lib/submit";
import {
  ARTEN,
  TECH_GROUPS,
  TERMINE,
  VORSCHLAEGE,
  emptyValues,
  parseDatum,
  fristPruefen,
  validate,
  type ArtId,
  type FormValues,
  type TerminId,
} from "@/lib/registration";

type Status = "idle" | "sending" | "sent" | "error";

const keinAbo = () => () => {};
function heuteAlsIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RegistrationForm() {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);

  // Leer beim Prerender, danach das heutige Datum des Browsers.
  const heuteIso = useSyncExternalStore(keinAbo, heuteAlsIso, () => "");
  const heute = useMemo(() => (heuteIso ? parseDatum(heuteIso) : null), [heuteIso]);

  const alle = useMemo(() => validate(values, heute), [values, heute]);
  const fehler = (key: string) => (submitted || touched[key] ? alle[key] : undefined);
  const sichtbareFehler = Object.entries(alle);

  const frist = fristPruefen(values.datum, values.arten, heute);
  const vorschlaege = ARTEN.filter((a) => values.arten.includes(a.id) && VORSCHLAEGE[a.id].length > 0);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleArt(id: ArtId, on: boolean) {
    set("arten", on ? [...values.arten, id] : values.arten.filter((a) => a !== id));
  }

  function toggleTech(id: string, on: boolean, excludes: string[] = []) {
    const next = { ...values.tech, [id]: on };
    if (on) for (const other of excludes) next[other] = false;
    set("tech", next);
  }

  function setTermin(id: TerminId, field: "datum" | "uhrzeit" | "ort", value: string) {
    set("termine", { ...values.termine, [id]: { ...values.termine[id], [field]: value } });
  }

  function focusField(id: string) {
    document.getElementById(id)?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(alle).length > 0) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setStatus("sending");
    const result = await sendeAnmeldung(values, files);
    if (result.ok) {
      setStatus("sent");
      requestAnimationFrame(() => done.current?.focus());
    } else {
      setStatus("error");
    }
  }

  function reset() {
    setValues(emptyValues());
    setFiles([]);
    setTouched({});
    setSubmitted(false);
    setStatus("idle");
    window.scrollTo({ top: 0 });
  }

  if (status === "sent") {
    return (
      <div ref={done} tabIndex={-1} className="outline-none">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Die Anmeldung ist eingegangen</h1>
        <p className="mt-4 max-w-[65ch] leading-relaxed">
          „{values.titel}“ am {datumLang(values.datum)} liegt jetzt beim Technikteam. Wir haben eine E-Mail an{" "}
          <span className="font-medium">{values.email}</span> geschickt. Darin steht der private Link, über den Sie
          Angaben ändern und Dateien nachreichen können.
        </p>
        <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">
          Kommt keine Mail an, schauen Sie bitte im Spam-Ordner nach. Der Link ist nur für Sie bestimmt.
        </p>
        <Button variant="outline" className="mt-8 h-11 border-input bg-surface px-5 shadow-none" onClick={reset}>
          Weitere Veranstaltung anmelden
        </Button>
      </div>
    );
  }

  const sending = status === "sending";
  const errorList = sichtbareFehler.length > 0 && submitted;

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onBlur={(e) => {
        const name = (e.target as unknown as HTMLInputElement).name;
        if (name) setTouched((t) => (t[name] ? t : { ...t, [name]: true }));
      }}
      aria-busy={sending}
    >
      <header className="mb-10 sm:mb-14">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Veranstaltung anmelden</h1>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-muted-foreground">
          Aus Ihrer Anmeldung planen wir Technik und Personal. Je früher sie bei uns liegt, desto mehr lässt sich
          umsetzen. Pflichtfelder sind mit * markiert.
        </p>
      </header>

      {errorList && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="mb-10 rounded-md border border-destructive/40 px-4 py-3 outline-none"
        >
          <p className="font-medium text-destructive">
            {sichtbareFehler.length === 1
              ? "Ein Feld braucht noch eine Angabe."
              : `${sichtbareFehler.length} Felder brauchen noch eine Angabe.`}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-sm">
            {sichtbareFehler.map(([key, msg]) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  onClick={(e) => {
                    e.preventDefault();
                    focusField(key);
                  }}
                  className="underline decoration-muted-foreground hover:decoration-foreground"
                >
                  {msg}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset disabled={sending} className="min-w-0">
        <legend className="sr-only">Veranstaltungsanmeldung</legend>

        <Section id="allgemein" nr="1" title="Allgemeine Informationen">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-6 md:gap-x-5">
            <TextField
              id="titel"
              label="Titel der Veranstaltung"
              required
              className="col-span-2 md:col-span-6"
              autoComplete="off"
              value={values.titel}
              onChange={(e) => set("titel", e.target.value)}
              error={fehler("titel")}
            />
            <TextField
              id="lehrkraft"
              label="Verantwortliche Lehrkraft"
              required
              className="col-span-2 md:col-span-3"
              autoComplete="name"
              value={values.lehrkraft}
              onChange={(e) => set("lehrkraft", e.target.value)}
              error={fehler("lehrkraft")}
            />
            <TextField
              id="email"
              label="E-Mail-Adresse"
              required
              type="email"
              className="col-span-2 md:col-span-3"
              autoComplete="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              error={fehler("email")}
            />
            <TextField
              id="datum"
              label="Datum"
              required
              type="date"
              className="col-span-2 md:col-span-2"
              value={values.datum}
              onChange={(e) => set("datum", e.target.value)}
              error={fehler("datum")}
            />
            <TextField
              id="beginn"
              label="Beginn"
              required
              type="time"
              className="md:col-span-2"
              value={values.beginn}
              onChange={(e) => set("beginn", e.target.value)}
              error={fehler("beginn")}
            />
            <TextField
              id="ende"
              label="Ende"
              required
              type="time"
              className="md:col-span-2"
              value={values.ende}
              onChange={(e) => set("ende", e.target.value)}
              error={fehler("ende")}
            />
            <TextField
              id="ort"
              label="Veranstaltungsort"
              required
              className="col-span-2 md:col-span-6"
              autoComplete="off"
              value={values.ort}
              onChange={(e) => set("ort", e.target.value)}
              error={fehler("ort")}
            />
          </div>
        </Section>

        <Section id="art" nr="2" title="Art der Veranstaltung">
          <fieldset>
            <legend className="sr-only">Art der Veranstaltung, Mehrfachauswahl möglich</legend>
            <div className="grid sm:grid-cols-2 sm:gap-x-10">
              {ARTEN.map((a) => (
                <Checkbox
                  key={a.id}
                  id={`art_${a.id}`}
                  label={a.label}
                  checked={values.arten.includes(a.id)}
                  onChange={(on) => toggleArt(a.id, on)}
                />
              ))}
            </div>
          </fieldset>
          {values.arten.includes("sonstiges") && (
            <TextField
              id="art_sonstiges"
              label="Welche Art von Veranstaltung?"
              className="mt-4 max-w-md"
              value={values.art_sonstiges}
              onChange={(e) => set("art_sonstiges", e.target.value)}
              error={fehler("art_sonstiges")}
            />
          )}
          <div role="status" aria-live="polite" className="mt-5 max-w-[65ch]">
            <FristHinweis frist={frist} />
          </div>
        </Section>

        <Section id="technik" nr="3" title="Benötigte Technik">
          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {TECH_GROUPS.map((g) => (
              <fieldset key={g.id} className="min-w-0">
                <legend className="mb-1 text-sm font-medium text-muted-foreground">{g.label}</legend>
                {g.items.map((item) => (
                  <Checkbox
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    checked={!!values.tech[item.id]}
                    onChange={(on) => toggleTech(item.id, on, item.excludes)}
                    aside={
                      item.count && values.tech[item.id] ? (
                        <CountField
                          id={item.count}
                          label={item.label}
                          value={values[item.count]}
                          onChange={(v) => set(item.count!, v)}
                          error={!!fehler(item.count)}
                        />
                      ) : undefined
                    }
                    below={
                      item.count ? <FieldError id={`${item.count}-error`}>{fehler(item.count)}</FieldError> : undefined
                    }
                  />
                ))}
              </fieldset>
            ))}
          </div>
        </Section>

        <Section id="betreuung" nr="4" title="Betreuung während der Veranstaltung">
          <fieldset>
            <legend className="sr-only">Benötigte Betreuung</legend>
            <Checkbox
              id="betreuung_ton"
              label="Tontechniker erforderlich"
              checked={values.betreuung_ton}
              onChange={(on) => set("betreuung_ton", on)}
            />
            <Checkbox
              id="betreuung_licht"
              label="Lichttechniker erforderlich"
              checked={values.betreuung_licht}
              onChange={(on) => set("betreuung_licht", on)}
            />
          </fieldset>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Ohne Betreuung richtet das Technikteam die Technik nach Möglichkeit vor Beginn ein und holt sie danach ab.
          </p>
        </Section>

        <Section id="details" nr="5" title="Technische Details">
          <TextArea
            id="technische_details"
            label="Was sollen wir sonst noch wissen?"
            hint="Optional, falls nicht schon über Skript oder Ablaufplan abgedeckt: Mikrofonzuordnung, Zuspielungen, Besonderheiten."
            value={values.technische_details}
            onChange={(e) => set("technische_details", e.target.value)}
          />
        </Section>

        <Section id="termine" nr="6" title="Termine">
          <div className="space-y-6 md:space-y-4">
            {TERMINE.map((t, i) => (
              <div
                key={t.id}
                role="group"
                aria-labelledby={`termin_${t.id}_titel`}
                className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-[6.5rem_10rem_7rem_1fr] md:items-end"
              >
                <p id={`termin_${t.id}_titel`} className="col-span-2 text-sm font-medium md:col-span-1 md:flex md:h-10 md:items-center">
                  {t.label}
                </p>
                <TextField
                  id={`${t.id}_datum`}
                  label="Datum"
                  hideLabel={i > 0}
                  type={t.freitext ? "text" : "date"}
                  placeholder={t.freitext ? "mehrere möglich" : undefined}
                  className={t.freitext ? "col-span-2 md:col-span-1" : undefined}
                  value={values.termine[t.id].datum}
                  onChange={(e) => setTermin(t.id, "datum", e.target.value)}
                />
                <TextField
                  id={`${t.id}_uhrzeit`}
                  label="Uhrzeit"
                  hideLabel={i > 0}
                  type={t.freitext ? "text" : "time"}
                  placeholder={t.freitext ? "z. B. 15 Uhr" : undefined}
                  className={t.freitext ? "col-span-2 md:col-span-1" : undefined}
                  value={values.termine[t.id].uhrzeit}
                  onChange={(e) => setTermin(t.id, "uhrzeit", e.target.value)}
                />
                <TextField
                  id={`${t.id}_ort`}
                  label="Ort / Anmerkung"
                  hideLabel={i > 0}
                  className="col-span-2 md:col-span-1"
                  value={values.termine[t.id].ort}
                  onChange={(e) => setTermin(t.id, "ort", e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-[65ch] text-sm text-muted-foreground">
            Die Veranstaltung selbst steht schon in Abschnitt 1. Eintragen müssen Sie hier nur, was davon abweicht.
          </p>
        </Section>

        <Section id="anmerkungen" nr="7" title="Sonstige Anmerkungen">
          <TextArea
            id="anmerkungen"
            label="Weitere Informationen oder besondere Wünsche"
            value={values.anmerkungen}
            onChange={(e) => set("anmerkungen", e.target.value)}
          />
        </Section>

        <Section id="unterlagen" nr="8" title="Unterlagen">
          <div className="mb-4 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            <p>
              Laden Sie hoch, was uns beim Planen hilft. Nichts davon ist Pflicht, und Sie können alles auch später über
              Ihren privaten Link nachreichen.
            </p>
            {vorschlaege.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {vorschlaege.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-foreground">{a.label}:</span> {VORSCHLAEGE[a.id].join(", ")}.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">
                Häufig helfen ein Ablaufplan, ein Skript, ein Mikrofonplan oder Präsentationen. Welche Art Sie in
                Abschnitt 2 wählen, bestimmt, was wir hier vorschlagen.
              </p>
            )}
          </div>
          <FileDrop files={files} onChange={setFiles} />
        </Section>

        <div className="mt-16">
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Nachträgliche Änderungen teilen Sie uns bitte so früh wie möglich mit. Kurzfristige Änderungen lassen sich
            je nach Umfang nicht mehr umsetzen.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button type="submit" className="h-12 w-full px-8 text-[15px] sm:w-auto" disabled={sending}>
              {sending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {sending ? "Wird gesendet" : "Anmeldung senden"}
            </Button>
            {status === "error" && (
              <p role="alert" className="text-sm text-destructive">
                Das Senden hat nicht geklappt. Ihre Angaben sind noch da. Bitte versuchen Sie es noch einmal.
              </p>
            )}
          </div>
        </div>
      </fieldset>
    </form>
  );
}

function FristHinweis({ frist }: { frist: ReturnType<typeof fristPruefen> }) {
  if (!frist) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Theater und Konzert melden Sie bitte mindestens 4 Wochen vorher an. Informationsveranstaltung,
        Podiumsdiskussion und Vortrag brauchen mindestens 2 Wochen. Für Sonstiges sprechen wir die Frist ab. Früher
        ist immer besser.
      </p>
    );
  }
  if (frist.status === "vergangen") {
    return <p className="text-sm text-muted-foreground">Das gewählte Datum liegt in der Vergangenheit.</p>;
  }
  if (frist.status === "absprache") {
    return <p className="text-sm text-muted-foreground">Bei Sonstigem stimmen wir die Frist mit Ihnen ab.</p>;
  }
  const wochen = frist.noetig / 7;
  const mehrere = frist.mehrere ? " Bei mehreren Arten gilt die längste Frist." : "";
  if (frist.status === "ok") {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Das passt. Bis zur Veranstaltung sind es noch {frist.vorhanden} Tage. {frist.art} braucht mindestens {wochen}{" "}
        Wochen.{mehrere}
      </p>
    );
  }
  return (
    <p className="rounded-md bg-note px-4 py-3 text-sm leading-relaxed text-note-foreground">
      Das ist knapp. Bis zur Veranstaltung sind es noch {frist.vorhanden} Tage, {frist.art} braucht mindestens{" "}
      {wochen} Wochen.{mehrere} Sie können trotzdem anmelden. Wir melden uns, ob und wie wir es noch schaffen.
    </p>
  );
}
