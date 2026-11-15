import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { Laden } from "@/components/laden";
import { Unterlagen } from "@/components/unterlagen/unterlagen";
import { darf } from "@/lib/berechtigungen";
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
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { oeffneFuerTeam } from "@/lib/server/team-anmeldungen";
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

async function AnmeldungInhalt({ params }: { params: Promise<{ id: string }> }) {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.lesen" });
  const { id } = await params;
  const ergebnis = oeffneFuerTeam(konto, id, await anfrageKontext());
  if (!ergebnis) notFound();

  const { anmeldung, dateien, aenderungen } = ergebnis;
  const v = anmeldung.values;
  const heute = heuteBerlin();
  const frist = fristBeiAnmeldung(v, anmeldung.erstelltAm);
  const knapp = frist && frist.status === "knapp" ? frist : null;
  const fehlen = unterlagenFehlen(
    { ...alsListeneintrag({ ...anmeldung, dateien, aenderungen }) },
    heute,
  );
  const gruppen = technikGruppen(v);
  const termine = terminListe(v);
  const techniker = betreuungNoetig(v);
  const arten = v.arten.map((a) => (a === "sonstiges" && v.art_sonstiges.trim() ? v.art_sonstiges.trim() : artBezeichnung(a)));
  const bevorstehend = v.datum >= heute;

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
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{v.titel}</h1>
        <p className="mt-3 text-lg font-medium">
          {datumLangMitWochentag(v.datum)}
          {bevorstehend && <span className="ml-2 text-base font-normal text-muted-foreground">{inTagen(v.datum, heute)}</span>}
        </p>
        <p className="mt-0.5 text-[15px] tabular-nums text-muted-foreground">
          {v.beginn} bis {v.ende} Uhr, {v.ort}
        </p>

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

      <dl className="mt-8 grid gap-x-8 gap-y-5 border-y border-border py-5 @xl:grid-cols-3">
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

      <div className="mt-12 grid gap-x-14 gap-y-14 @2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="@container space-y-14">
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
            <ul className="space-y-3 text-[15px]">
              {aenderungen.map((a) => (
                <li key={a.zeit}>
                  <p className="text-sm tabular-nums text-muted-foreground">{datumZeit(a.zeit)}</p>
                  <p>Geändert: {a.felder.map(feldBezeichnung).join(", ")}</p>
                </li>
              ))}
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
