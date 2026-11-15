import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Laden } from "@/components/laden";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { darf } from "@/lib/berechtigungen";
import {
  artBezeichnung,
  betreuungKurz,
  feldBezeichnung,
  fristBeiAnmeldung,
  technikGruppen,
} from "@/lib/dashboard";
import { datumLangMitWochentag, datumNumerisch, datumZeit, heuteBerlin, inTagen } from "@/lib/format";
import { TERMINE, dateiGroesse } from "@/lib/registration";
import { anfrageKontext, verlangeSitzung } from "@/lib/server/auth/dal";
import { oeffneFuerTeam } from "@/lib/server/team-anmeldungen";
import { AnmeldungLoeschen } from "./loeschen";

export const metadata = { title: "Anmeldung | Technikteam" };

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section aria-label={titel} className="mt-10 first:mt-0">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{titel}</h2>
      {children}
    </section>
  );
}

function Liste({ zeilen }: { zeilen: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px] sm:grid-cols-[10rem_minmax(0,1fr)]">
      {zeilen.map(([name, wert]) => (
        <div key={name} className="contents">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="min-w-0 break-words">{wert}</dd>
        </div>
      ))}
    </dl>
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
  const gruppen = technikGruppen(v);
  const termine = TERMINE.filter((t) => {
    const x = v.termine[t.id];
    return x.datum || x.uhrzeit || x.ort;
  });
  const arten = v.arten.map((a) => (a === "sonstiges" && v.art_sonstiges.trim() ? `Sonstiges: ${v.art_sonstiges.trim()}` : artBezeichnung(a)));

  return (
    <div className="max-w-[46rem]">
      <Link
        href="/team"
        className="-ml-1 mb-6 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Alle Anmeldungen
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{v.titel}</h1>
      <p className="mt-2 text-[15px]">
        {datumLangMitWochentag(v.datum)}, {v.beginn} bis {v.ende} Uhr
        {v.datum >= heute && <span className="text-muted-foreground"> ({inTagen(v.datum, heute)})</span>}
      </p>
      <p className="text-[15px] text-muted-foreground">{v.ort}</p>

      {frist && frist.status === "knapp" && (
        <p className="mt-5 rounded-md bg-note px-4 py-3 text-sm leading-relaxed text-note-foreground">
          Zu knapp angemeldet. Die Anmeldung kam {frist.vorhanden} Tage vor der Veranstaltung, {frist.art} braucht
          mindestens {frist.noetig / 7} Wochen.
        </p>
      )}

      <div className="mt-10">
        <Abschnitt titel="Allgemeines">
          <Liste
            zeilen={[
              ["Lehrkraft", v.lehrkraft],
              ["E-Mail", <a key="m" href={`mailto:${v.email}`} className="underline underline-offset-4">{v.email}</a>],
              ["Art", arten.length > 0 ? arten.join(", ") : <span className="text-muted-foreground">Nicht angegeben</span>],
              ["Angemeldet am", datumZeit(anmeldung.erstelltAm)],
            ]}
          />
        </Abschnitt>

        <Abschnitt titel="Technik">
          {gruppen.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Keine Technik angegeben.</p>
          ) : (
            <Liste zeilen={gruppen.map((g) => [g.gruppe, g.punkte.join(", ")] as [string, ReactNode])} />
          )}
          <p className="mt-4 text-[15px]">{betreuungKurz(v)}</p>
          {!v.betreuung_ton && !v.betreuung_licht && (
            <p className="mt-1 text-sm text-muted-foreground">
              Das Team richtet die Technik vor Beginn ein und holt sie danach ab.
            </p>
          )}
        </Abschnitt>

        {v.technische_details.trim() && (
          <Abschnitt titel="Technische Details">
            <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed">{v.technische_details}</p>
          </Abschnitt>
        )}

        {termine.length > 0 && (
          <Abschnitt titel="Termine">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-[15px]">
                <caption className="sr-only">Termine rund um die Veranstaltung</caption>
                <thead>
                  <tr className="border-b border-border text-sm text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Termin</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Datum</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Uhrzeit</th>
                    <th scope="col" className="py-2 font-medium">Ort / Anmerkung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {termine.map((t) => {
                    const x = v.termine[t.id];
                    const datum = /^\d{4}-\d{2}-\d{2}$/.test(x.datum) ? datumNumerisch(x.datum) : x.datum;
                    return (
                      <tr key={t.id}>
                        <th scope="row" className="py-2.5 pr-4 font-medium">{t.label}</th>
                        <td className="py-2.5 pr-4 tabular-nums">{datum || "–"}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{x.uhrzeit || "–"}</td>
                        <td className="py-2.5">{x.ort || "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Abschnitt>
        )}

        {v.anmerkungen.trim() && (
          <Abschnitt titel="Anmerkungen">
            <p className="max-w-[65ch] whitespace-pre-wrap text-[15px] leading-relaxed">{v.anmerkungen}</p>
          </Abschnitt>
        )}

        <Abschnitt titel="Unterlagen">
          {dateien.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Die Lehrkraft hat noch nichts hochgeladen.</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {dateien.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className="min-w-0 flex-1 break-all text-[15px]">{d.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {dateiGroesse(d.groesse)} · hochgeladen am {datumNumerisch(d.erstelltAm)}
                  </span>
                  <a
                    href={`/team/dateien/${anmeldung.id}/${d.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-surface px-3 text-sm font-medium transition-colors hover:border-foreground/50"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Herunterladen
                    <span className="sr-only">: {d.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>

        <Abschnitt titel="Änderungen">
          {aenderungen.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Seit der Anmeldung wurde nichts geändert.</p>
          ) : (
            <ul className="space-y-2 text-[15px]">
              {aenderungen.map((a) => (
                <li key={a.zeit} className="flex flex-wrap gap-x-4">
                  <span className="tabular-nums text-muted-foreground">{datumZeit(a.zeit)}</span>
                  <span>{a.felder.map(feldBezeichnung).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>

        {darf(konto.rolle, "anmeldungen.loeschen") && (
          <div className="mt-14 border-t border-border pt-6">
            <AnmeldungLoeschen id={anmeldung.id} titel={v.titel} />
          </div>
        )}
      </div>
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
