"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/fields";
import { FormularAbschnitte, useFormular } from "@/components/formular-abschnitte";
import { FileDrop } from "@/components/file-drop";
import { BelegungsEinklapper, BelegungsHinweis, BelegungsPanel, useBelegung } from "@/components/belegung";
import { datumLang, sendeAnmeldung, type MailStand } from "@/lib/submit";
import { ARTEN, VORSCHLAEGE, emptyValues, parseDatum, fristPruefen, validate } from "@/lib/registration";

type Status = "idle" | "sending" | "sent" | "error";

const keinAbo = () => () => {};
function heuteAlsIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RegistrationForm() {
  const formular = useFormular(emptyValues());
  const { values, setValues } = formular;
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [mail, setMail] = useState<MailStand>("gesendet");
  const [serverFehler, setServerFehler] = useState<Record<string, string>>({});
  const [dateiFehler, setDateiFehler] = useState<string[]>([]);
  const [meldung, setMeldung] = useState<string | null>(null);
  // Schutz vor Programmen: ein verstecktes Feld und der Zeitpunkt, an dem das Formular erschien.
  const falle = useRef<HTMLInputElement>(null);
  const gestartet = useRef(0);
  useEffect(() => {
    gestartet.current = Date.now();
  }, []);
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);

  // Leer beim Prerender, danach das heutige Datum des Browsers.
  const heuteIso = useSyncExternalStore(keinAbo, heuteAlsIso, () => "");
  const heute = useMemo(() => (heuteIso ? parseDatum(heuteIso) : null), [heuteIso]);
  const { liste, fehlgeschlagen } = useBelegung();

  const alle = useMemo(() => validate(values, heute), [values, heute]);
  const fehler = (key: string) => serverFehler[key] ?? (submitted || touched[key] ? alle[key] : undefined);
  const sichtbareFehler = Object.entries({ ...alle, ...serverFehler });

  const frist = fristPruefen(values.datum, values.arten, heute);
  const vorschlaege = ARTEN.filter((a) => values.arten.includes(a.id) && VORSCHLAEGE[a.id].length > 0);

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
    setServerFehler({});
    setDateiFehler([]);
    setMeldung(null);
    const result = await sendeAnmeldung(values, files, { gestartet: gestartet.current, webseite: falle.current?.value ?? "" });
    if (result.ok) {
      setMail(result.mail);
      setStatus("sent");
      requestAnimationFrame(() => done.current?.focus());
    } else {
      setServerFehler(result.fehler);
      setDateiFehler(result.dateiFehler);
      setMeldung(result.message ?? (Object.keys(result.fehler).length + result.dateiFehler.length === 0 ? "Das Senden hat nicht geklappt. Ihre Angaben sind noch da. Bitte versuchen Sie es noch einmal." : null));
      setStatus("error");
      requestAnimationFrame(() => summary.current?.focus());
    }
  }

  function reset() {
    setValues(emptyValues());
    setFiles([]);
    setTouched({});
    setSubmitted(false);
    setStatus("idle");
    setServerFehler({});
    setDateiFehler([]);
    setMeldung(null);
    gestartet.current = Date.now();
    window.scrollTo({ top: 0 });
  }

  if (status === "sent") {
    return (
      <Rahmen>
      <div ref={done} tabIndex={-1} className="outline-none">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Die Anmeldung ist eingegangen</h1>
        <p className="mt-4 max-w-[65ch] leading-relaxed">
          „{values.titel}“ am {datumLang(values.datum)} liegt jetzt beim Technikteam.{" "}
          {mail === "gesendet" ? (
            <>
              Wir haben eine E-Mail an <span className="font-medium">{values.email}</span> geschickt. Darin steht der
              private Link, über den Sie Angaben ändern und Dateien nachreichen können.
            </>
          ) : (
            <>Die E-Mail mit dem privaten Link konnte leider nicht verschickt werden.</>
          )}
        </p>
        <p className="mt-3 max-w-[65ch] leading-relaxed text-muted-foreground">
          {mail === "gesendet"
            ? "Kommt keine Mail an, schauen Sie bitte im Spam-Ordner nach. Der Link ist nur für Sie bestimmt."
            : "Ihre Anmeldung ist trotzdem gespeichert und das Team sieht sie. Möchten Sie etwas ändern oder nachreichen, sagen Sie dem Technikteam bitte kurz Bescheid."}
        </p>
        <Button variant="outline" className="mt-8 h-11 border-input bg-surface px-5 shadow-none" onClick={reset}>
          Weitere Veranstaltung anmelden
        </Button>
      </div>
      </Rahmen>
    );
  }

  const sending = status === "sending";
  const errorList = (sichtbareFehler.length > 0 && submitted) || !!meldung || dateiFehler.length > 0;

  // Die Belegung braucht das heutige Datum des Browsers und gibt es deshalb erst nach dem Laden.
  const panel = {
    heute: heuteIso,
    datum: values.datum,
    liste,
    fehlgeschlagen,
    onWaehle: (tag: string) => formular.set("datum", tag),
  };

  return (
    <Rahmen
      seite={
        heuteIso && (
          <section aria-labelledby="belegung-titel" className="rounded-lg border border-border bg-surface p-5">
            <h2 id="belegung-titel" className="text-lg font-semibold tracking-tight">
              Belegung des Teams
            </h2>
            <p className="mb-4 mt-1 text-sm leading-relaxed text-muted-foreground">
              Überschneidungen sind kein Problem, wir melden uns bei Ihnen.
            </p>
            <BelegungsPanel {...panel} kartenHoehe="max-h-[calc(100dvh-32rem)] min-h-40" />
          </section>
        )
      }
    >
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
          {meldung && <p className="font-medium text-destructive">{meldung}</p>}
          {dateiFehler.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm text-destructive">
              {dateiFehler.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {sichtbareFehler.length > 0 && (
            <p className={meldung || dateiFehler.length > 0 ? "mt-3 font-medium text-destructive" : "font-medium text-destructive"}>
              {sichtbareFehler.length === 1
                ? "Ein Feld braucht noch eine Angabe."
                : `${sichtbareFehler.length} Felder brauchen noch eine Angabe.`}
            </p>
          )}
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

        {/* Falle für Programme: Menschen sehen das Feld nicht und lassen es leer. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Bitte leer lassen
            <input ref={falle} type="text" name="webseite" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <FormularAbschnitte f={formular} fehler={fehler} fristHinweis={<FristHinweis frist={frist} />}
          belegung={
            heuteIso ? (
              <>
                <BelegungsHinweis heute={heuteIso} datum={values.datum} beginn={values.beginn} ende={values.ende} liste={liste} />
                <BelegungsEinklapper {...panel} />
              </>
            ) : null
          }
        />

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
              <p className="text-sm text-destructive">Das Senden hat nicht geklappt. Ihre Angaben sind noch da.</p>
            )}
          </div>
        </div>
      </fieldset>
    </form>
    </Rahmen>
  );
}

/**
 * Das Formular steht in einer Karte. Ab 1280 Pixel Breite sitzt rechts daneben die Belegung des Teams
 * und bleibt beim Scrollen im Bild, so dass beim Ausfüllen immer sichtbar ist, was schon vergeben ist.
 */
function Rahmen({ children, seite }: { children: React.ReactNode; seite?: React.ReactNode }) {
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,48rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
      <main className="rounded-lg border border-border bg-surface px-5 py-9 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-12 sm:py-14">
        {children}
      </main>
      {seite && <aside className="sticky top-6 hidden xl:block">{seite}</aside>}
    </div>
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
