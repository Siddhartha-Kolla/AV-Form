"use client";

import { useState, type ReactNode } from "react";
import { Checkbox, CountField, FieldError, Section, TextArea, TextField } from "@/components/fields";
import { ARTEN, TECH_GROUPS, TERMINE, type ArtId, type FormValues, type TerminId } from "@/lib/registration";

/** Zustand und Änderungsfunktionen für alle Felder des Anmeldeformulars. */
export function useFormular(start: FormValues) {
  const [values, setValues] = useState<FormValues>(start);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleArt(id: ArtId, on: boolean) {
    setValues((v) => ({ ...v, arten: on ? [...v.arten, id] : v.arten.filter((a) => a !== id) }));
  }

  function toggleTech(id: string, on: boolean, excludes: string[] = []) {
    setValues((v) => {
      const next = { ...v.tech, [id]: on };
      if (on) for (const other of excludes) next[other] = false;
      return { ...v, tech: next };
    });
  }

  function setTermin(id: TerminId, field: "datum" | "uhrzeit" | "ort", value: string) {
    setValues((v) => ({ ...v, termine: { ...v.termine, [id]: { ...v.termine[id], [field]: value } } }));
  }

  return { values, setValues, set, toggleArt, toggleTech, setTermin };
}

export type Formular = ReturnType<typeof useFormular>;

/**
 * Die Abschnitte 1 bis 7 des Formulars. Sie werden vom Formular für Lehrkräfte und von der Bearbeitung
 * durch das Team gemeinsam benutzt, damit beide immer dieselben Felder in derselben Reihenfolge zeigen.
 */
export function FormularAbschnitte({
  f,
  fehler,
  fristHinweis,
  belegung,
}: {
  f: Formular;
  fehler: (key: string) => string | undefined;
  /** Hinweis zur Anmeldefrist unter der Art. Das Team braucht ihn nicht. */
  fristHinweis?: ReactNode;
  /** Hinweis zur Belegung des Teams unter den Zeitfeldern. Nur für Lehrkräfte. */
  belegung?: ReactNode;
}) {
  const { values, set, toggleArt, toggleTech, setTermin } = f;
  return (
    <>
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
        {belegung && <div className="col-span-2 space-y-2 md:col-span-6">{belegung}</div>}
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
      {fristHinweis && (
        <div role="status" aria-live="polite" className="mt-5 max-w-[65ch]">
          {fristHinweis}
        </div>
      )}
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
    </>
  );
}
