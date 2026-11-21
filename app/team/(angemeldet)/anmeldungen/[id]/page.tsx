import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Check, ChevronLeft, Clock, MessageCircleQuestion, Pencil, TriangleAlert, X } from "lucide-react";
import { Laden } from "@/components/laden";
import { Unterlagen } from "@/components/unterlagen/unterlagen";
import { darf } from "@/lib/berechtigungen";
import { besetzungGesperrt } from "@/lib/besetzung";
import {
  alsListeneintrag,
  artBezeichnung,
  betreuungNoetig,
  feldBezeichnung,
  fristBeiAnmeldung,
  technikGruppen,
  terminListe,
  unterlagenFehlen,
} from "@/lib/dashboard";
import {
  datumKurz,
  datumLangMitWochentag,
  datumZeit,
  heuteBerlin,
  inTagen,
} from "@/lib/format";
import type { Entscheidung, StatusId } from "@/lib/entscheidung";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import type { EntscheidungsEintrag } from "@/lib/server/anmeldungen";
import { ladeBesetzung } from "@/lib/server/einsaetze";
import { oeffneFuerTeam } from "@/lib/server/team-anmeldungen";
import { Besetzung } from "./besetzung";
import { Entscheidungsknoepfe } from "./entscheidung";
import { AnmeldungLoeschen } from "./loeschen";

export const metadata = { title: "Anmeldung | Technikteam" };

/** Abschnitt mit kurzer Überschrift. Die Gliederung entsteht durch Abstand, nicht durch Rahmen. */
function Abschnitt({ titel, hinweis, children }: { titel: string; hinweis?: string; children: ReactNode }) {
  return (
    <section aria-label={titel}>
      <h2 className="text-lg font-semibold tracking-tight">{titel}</h2>
      {hinweis && <p className="mt-0.5 text-sm text-muted-foreground">{hinweis}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fakt({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{name}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-medium">{children}</dd>
    </div>
  );
}

const VERLAUF_TEXT: Record<Entscheidung, string> = {
  angenommen: "Angenommen",
  rueckfrage: "Rückfrage gestellt",
  abgelehnt: "Abgelehnt",
};

const STATUS_SYMBOL: Record<StatusId, { symbol: typeof Check; farbe: string }> = {
  neu: { symbol: Clock, farbe: "text-note-foreground" },
  angenommen: { symbol: Check, farbe: "text-primary" },
  rueckfrage: { symbol: MessageCircleQuestion, farbe: "text-note-foreground" },
  abgelehnt: { symbol: X, farbe: "text-muted-foreground" },
};

const STATUS_TITEL: Record<StatusId, string> = {
  neu: "Wartet auf eine Entscheidung",
  angenommen: "Angenommen",
  rueckfrage: "Rückfrage an die Lehrkraft offen",
  abgelehnt: "Abgelehnt, nicht im Zeitplan",
};

/** Der Stand der Entscheidung: was gilt, wer es wann entschieden hat und was die Lehrkraft erfahren hat. */
function EntscheidungsFeld({
  id,
  status,
  entscheidungen,
  kannEntscheiden,
}: {
  id: string;
  status: StatusId;
  entscheidungen: EntscheidungsEintrag[];
  kannEntscheiden: boolean;
}) {
  const { symbol: Symbol, farbe } = STATUS_SYMBOL[status];
  const letzte = entscheidungen[0];
  const aktuell = status === "neu" ? null : entscheidungen.find((e) => e.status === status);
  const unterzeile =
    status === "neu"
      ? letzte
        ? `Die Lehrkraft hat die Anmeldung am ${datumZeit(letzte.zeit)} geändert. Bitte noch einmal prüfen.`
        : "Nimm die Anmeldung an, stelle eine Rückfrage oder lehne sie ab."
      : aktuell
        ? `${aktuell.von ?? "Das Team"}, ${datumZeit(aktuell.zeit)}`
        : "";

  return (
    <section aria-label="Entscheidung" className="mt-6 rounded-lg bg-muted/60 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-[62ch] flex-1">
          <p className={`flex items-center gap-2 text-[15px] font-semibold ${farbe}`}>
            <Symbol className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-foreground">{STATUS_TITEL[status]}</span>
          </p>
          {unterzeile && <p className="mt-1 text-sm text-muted-foreground">{unterzeile}</p>}
          {aktuell?.nachricht && (
            <p className="mt-3 whitespace-pre-wrap border-l-2 border-border pl-3 text-[15px] leading-relaxed">{aktuell.nachricht}</p>
          )}
        </div>
        {kannEntscheiden && <Entscheidungsknoepfe id={id} status={status} />}
      </div>
    </section>
  );
}

async function AnmeldungInhalt({ params }: { params: Promise<{ id: string }> }) {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.lesen" });
  const { id } = await params;
  const ergebnis = oeffneFuerTeam(konto, id, await anfrageKontext());
  if (!ergebnis) notFound();

  const { anmeldung, dateien, aenderungen, entscheidungen } = ergebnis;
  const status = anmeldung.status;
  const v = anmeldung.values;
  const heute = heuteBerlin();
  const frist = fristBeiAnmeldung(v, anmeldung.erstelltAm);
  // Abgelehntes steht nicht im Zeitplan, deshalb gibt es dazu keine Warnungen mehr.
  const imZeitplan = status !== "abgelehnt";
  // Hinweise gibt es nur, solange noch zu entscheiden ist. Danach genügen Status und Unterlagenliste.
  const offen = status === "neu" || status === "rueckfrage";
  const knapp = offen && frist && frist.status === "knapp" ? frist : null;
  const fehlen = offen && unterlagenFehlen(alsListeneintrag({ ...anmeldung, dateien, aenderungen }), heute);
  const gruppen = technikGruppen(v);
  const termine = terminListe(v);
  const techniker = betreuungNoetig(v);
  const arten = v.arten.map((a) => (a === "sonstiges" && v.art_sonstiges.trim() ? v.art_sonstiges.trim() : artBezeichnung(a)));
  const bevorstehend = v.datum >= heute;
  const besetzung = imZeitplan ? ladeBesetzung(konto, anmeldung.id) : null;
  // Änderungen und Entscheidungen in einer Zeitleiste, die neueste oben.
  const verlauf = [
    ...aenderungen.map((a) => ({ art: "aenderung" as const, zeit: a.zeit, a })),
    ...entscheidungen.map((e) => ({ art: "entscheidung" as const, zeit: e.zeit, e })),
  ].sort((x, y) => y.zeit.localeCompare(x.zeit));

  return (
    // @container: Die Spalten richten sich nach dem Platz, der der Seite bleibt, auch wenn rechts die Vorschau steht.
    <div className="@container">
      <Link
        href="/team"
        className="-ml-1 mb-6 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Alle Anmeldungen
      </Link>

      <header>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="min-w-0 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{v.titel}</h1>
          {darf(konto.rolle, "anmeldungen.bearbeiten") && (
            <Link
              href={`/team/anmeldungen/${anmeldung.id}/bearbeiten`}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-input bg-surface px-4 text-[15px] font-medium transition-colors hover:border-foreground/50"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Bearbeiten
            </Link>
          )}
        </div>
        <p className="mt-3 text-lg font-medium">
          {datumLangMitWochentag(v.datum)}
          {bevorstehend && <span className="ml-2 text-base font-normal text-muted-foreground">{inTagen(v.datum, heute)}</span>}
        </p>
        <p className="mt-0.5 text-[15px] tabular-nums text-muted-foreground">
          {v.beginn} bis {v.ende} Uhr, {v.ort}
        </p>
        {status === "angenommen" && (
          <a
            href={`/team/anmeldungen/${anmeldung.id}/termin.ics`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Zum Kalender hinzufügen
          </a>
        )}

        {(knapp || fehlen) && (
          <ul className="mt-5 space-y-1.5 text-sm font-medium text-note-foreground">
            {knapp && (
              <li className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Zu knapp angemeldet: {knapp.vorhanden} statt {knapp.noetig} Tage Vorlauf für {knapp.art}.
                </span>
              </li>
            )}
            {fehlen && (
              <li className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Es sind noch keine Unterlagen hochgeladen.</span>
              </li>
            )}
          </ul>
        )}
      </header>

      <EntscheidungsFeld
        id={anmeldung.id}
        status={status}
        entscheidungen={entscheidungen}
        kannEntscheiden={darf(konto.rolle, "anmeldungen.entscheiden")}
      />

      <dl className="mt-8 grid gap-x-8 gap-y-5 @xl:grid-cols-3">
        <Fakt name="Lehrkraft">
          {v.lehrkraft}
          <a href={`mailto:${v.email}`} className="mt-0.5 block text-sm font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {v.email}
          </a>
        </Fakt>
        <Fakt name="Art">{arten.length > 0 ? arten.join(", ") : <span className="font-normal text-muted-foreground">Nicht angegeben</span>}</Fakt>
        <Fakt name="Techniker">
          {techniker ? (
            techniker
          ) : (
            <>
              Keine
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">Das Team richtet ein und holt ab.</span>
            </>
          )}
        </Fakt>
      </dl>

      <div className="mt-10 grid gap-x-14 gap-y-14 border-t border-border pt-10 @2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="@container space-y-14">
          {besetzung && (
            <Abschnitt titel="Besetzung">
              <Besetzung
                anmeldungId={anmeldung.id}
                pflicht={besetzung.pflicht}
                benoetigt={besetzung.benoetigt}
                personen={besetzung.personen}
                meineId={konto.id}
                kannPlanen={darf(konto.rolle, "einsaetze.planen")}
                gesperrt={besetzungGesperrt(status, v.datum, heute)}
              />
            </Abschnitt>
          )}

          <Abschnitt titel="Technik">
            {gruppen.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Keine Technik angegeben.</p>
            ) : (
              <div className="grid gap-x-10 gap-y-6 @lg:grid-cols-2">
                {gruppen.map((g) => (
                  <div key={g.gruppe}>
                    <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">{g.gruppe}</h3>
                    <ul className="space-y-1 text-[15px]">
                      {g.punkte.map((p) => (
                        <li key={p.text}>
                          {p.anzahl ? (
                            <>
                              <span className="font-semibold tabular-nums">{p.anzahl}</span> {p.text}
                            </>
                          ) : (
                            p.text
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Abschnitt>

          <Abschnitt titel="Ablauf" hinweis="Alle Termine in zeitlicher Reihenfolge.">
            <ol className="divide-y divide-border border-y border-border">
              {termine.map((t) => (
                <li key={t.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 py-3 text-[15px] sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                  <p className={t.haupt ? "font-semibold tabular-nums" : "tabular-nums text-muted-foreground"}>
                    {t.datum ? datumKurz(t.datum) : t.datumText || ""}
                  </p>
                  <div className="min-w-0">
                    <p className={t.haupt ? "font-semibold" : "font-medium"}>{t.label}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">{[t.uhrzeit, t.ort].filter(Boolean).join(", ")}</p>
                    {t.zusatz && <p className="text-sm text-muted-foreground">{t.zusatz}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Abschnitt>

          {(v.technische_details.trim() || v.anmerkungen.trim()) && (
            <Abschnitt titel="Hinweise der Lehrkraft">
              <div className="space-y-6">
                {v.technische_details.trim() && (
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-muted-foreground">Technische Details</h3>
                    <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed">{v.technische_details}</p>
                  </div>
                )}
                {v.anmerkungen.trim() && (
                  <div>
                    <h3 className="mb-1 text-sm font-medium text-muted-foreground">Anmerkungen</h3>
                    <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed">{v.anmerkungen}</p>
                  </div>
                )}
              </div>
            </Abschnitt>
          )}
        </div>

        <aside className="space-y-12" aria-label="Unterlagen und Verlauf">
          <Abschnitt titel="Unterlagen" hinweis={dateien.length > 0 ? "Ein Klick öffnet die Vorschau." : undefined}>
            {dateien.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Die Lehrkraft hat noch nichts hochgeladen.</p>
            ) : (
              <Unterlagen anmeldungId={anmeldung.id} dateien={dateien} />
            )}
          </Abschnitt>

          <Abschnitt titel="Verlauf">
            <ul className="space-y-4 text-[15px]">
              {verlauf.map((eintrag) => {
                if (eintrag.art === "entscheidung") {
                  const e = eintrag.e;
                  return (
                    <li key={`e-${e.zeit}`}>
                      <p className="text-sm tabular-nums text-muted-foreground">{datumZeit(e.zeit)}</p>
                      <p>
                        {e.status === "neu"
                          ? "Wieder zu prüfen: Die Lehrkraft hat Änderungen eingetragen"
                          : `${e.von ?? "Das Team"}: ${VERLAUF_TEXT[e.status]}`}
                      </p>
                      {e.nachricht && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">Nachricht: {e.nachricht}</p>}
                    </li>
                  );
                }
                const a = eintrag.a;
                const felder = a.felder.filter((f) => !f.startsWith("datei")).map(feldBezeichnung);
                return (
                  <li key={`a-${a.zeit}`}>
                    <p className="text-sm tabular-nums text-muted-foreground">{datumZeit(a.zeit)}</p>
                    <p>
                      {a.von ? `${a.von}: ` : "Geändert: "}
                      {felder.length > 0 ? felder.join(", ") : a.dateienHinzu.length + a.dateienWeg.length > 0 ? "Unterlagen" : ""}
                    </p>
                    {a.dateienHinzu.length > 0 && (
                      <p className="text-sm text-muted-foreground">Hinzugefügt: {a.dateienHinzu.join(", ")}</p>
                    )}
                    {a.dateienWeg.length > 0 && (
                      <p className="text-sm text-muted-foreground">Entfernt: {a.dateienWeg.join(", ")}</p>
                    )}
                    {a.notiz && <p className="mt-0.5 text-sm text-muted-foreground">Vermerk: {a.notiz}</p>}
                  </li>
                );
              })}
              <li>
                <p className="text-sm tabular-nums text-muted-foreground">{datumZeit(anmeldung.erstelltAm)}</p>
                <p>Angemeldet von {v.lehrkraft}</p>
              </li>
            </ul>
          </Abschnitt>
        </aside>
      </div>

      {darf(konto.rolle, "anmeldungen.loeschen") && (
        <div className="mt-16 border-t border-border pt-6">
          <AnmeldungLoeschen id={anmeldung.id} titel={v.titel} />
        </div>
      )}
    </div>
  );
}

export default function AnmeldungSeite({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Laden />}>
      <AnmeldungInhalt params={params} />
    </Suspense>
  );
}
