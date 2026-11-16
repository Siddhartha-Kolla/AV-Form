import { Suspense } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Check, Clock, MessageCircleQuestion, Pencil, X } from "lucide-react";
import { Laden } from "@/components/laden";
import { artBezeichnung, betreuungNoetig, technikGruppen } from "@/lib/dashboard";
import type { StatusId } from "@/lib/entscheidung";
import { datumLangMitWochentag, datumNumerisch } from "@/lib/format";
import { dateiGroesse } from "@/lib/registration";
import { ladeFuerLehrkraft } from "@/lib/server/lehrkraft";
import { UngueltigerLink } from "./ungueltig";

const BANNER: Record<StatusId, { symbol: typeof Check; titel: string; text: string; farbe: string }> = {
  neu: {
    symbol: Clock,
    titel: "Eingegangen",
    text: "Das Technikteam prüft Ihre Anmeldung und meldet sich bei Ihnen.",
    farbe: "text-note-foreground",
  },
  angenommen: { symbol: Check, titel: "Angenommen", text: "Das Technikteam hat Ihre Anmeldung angenommen.", farbe: "text-primary" },
  rueckfrage: {
    symbol: MessageCircleQuestion,
    titel: "Das Technikteam hat eine Rückfrage",
    text: "Bitte ergänzen Sie Ihre Angaben oder reichen Sie Unterlagen nach.",
    farbe: "text-note-foreground",
  },
  abgelehnt: { symbol: X, titel: "Abgelehnt", text: "Das Technikteam kann diese Veranstaltung leider nicht übernehmen.", farbe: "text-muted-foreground" },
};

function Fakt({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{name}</dt>
      <dd className="mt-0.5 break-words text-[15px] font-medium">{children}</dd>
    </div>
  );
}

async function AnsichtInhalt({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const ansicht = ladeFuerLehrkraft(token);
  if (!ansicht) return <UngueltigerLink />;

  const { anmeldung, dateien, entscheidung, kannAendern, grund } = ansicht;
  const v = anmeldung.values;
  const banner = BANNER[anmeldung.status];
  const Symbol = banner.symbol;
  const gruppen = technikGruppen(v);
  const techniker = betreuungNoetig(v);
  const arten = v.arten.map((a) => (a === "sonstiges" && v.art_sonstiges.trim() ? v.art_sonstiges.trim() : artBezeichnung(a)));

  return (
    <div>
      <p className="text-sm text-muted-foreground">Ihre Anmeldung</p>
      <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{v.titel}</h1>
      <p className="mt-3 text-lg font-medium">{datumLangMitWochentag(v.datum)}</p>
      <p className="mt-0.5 text-[15px] tabular-nums text-muted-foreground">
        {v.beginn} bis {v.ende} Uhr, {v.ort}
      </p>

      <section aria-label="Stand" className="mt-8 rounded-lg border border-border px-5 py-4">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <Symbol className={`size-4 shrink-0 ${banner.farbe}`} aria-hidden="true" />
          {banner.titel}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{banner.text}</p>
        {entscheidung?.nachricht && (
          <p className="mt-3 whitespace-pre-wrap border-l-2 border-border pl-3 text-[15px] leading-relaxed">{entscheidung.nachricht}</p>
        )}
        {anmeldung.status === "angenommen" && (
          <p className="mt-3 text-sm text-muted-foreground">Ändern Sie später etwas, prüft das Team die Anmeldung noch einmal.</p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        {kannAendern ? (
          <Link
            href={`/anmeldung/${token}/bearbeiten`}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Pencil className="size-4" aria-hidden="true" />
            {anmeldung.status === "rueckfrage" ? "Angaben ergänzen" : "Angaben ändern oder Unterlagen nachreichen"}
          </Link>
        ) : (
          grund && <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{grund}</p>
        )}
      </div>

      <dl className="mt-10 grid gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-3">
        <Fakt name="Verantwortlich">{v.lehrkraft}</Fakt>
        <Fakt name="Art">{arten.length > 0 ? arten.join(", ") : <span className="font-normal text-muted-foreground">Nicht angegeben</span>}</Fakt>
        <Fakt name="Techniker">{techniker ?? <span className="font-normal text-muted-foreground">Keine</span>}</Fakt>
      </dl>

      <section aria-label="Technik" className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Technik</h2>
        {gruppen.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted-foreground">Keine Technik angegeben.</p>
        ) : (
          <div className="mt-3 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {gruppen.map((g) => (
              <div key={g.gruppe}>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">{g.gruppe}</h3>
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
      </section>

      <section aria-label="Unterlagen" className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Unterlagen</h2>
        {dateien.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted-foreground">Noch nichts hochgeladen. Sie können Unterlagen jederzeit nachreichen.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {dateien.map((d) => (
              <li key={d.id} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
                <span className="min-w-0 break-words">{d.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {dateiGroesse(d.groesse)}, {datumNumerisch(d.erstelltAm)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
        Dieser Link ist nur für Sie bestimmt. Wer ihn kennt, kann diese Anmeldung ändern. Bitte geben Sie ihn nicht weiter.
      </p>
    </div>
  );
}

export default function AnsichtSeite({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Laden />}>
      <AnsichtInhalt params={params} />
    </Suspense>
  );
}
