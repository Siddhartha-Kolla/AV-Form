import Link from "next/link";
import { ARTEN } from "@/lib/registration";
import {
  betreuungKurz,
  feldBezeichnung,
  filtere,
  istArt,
  juengsteAenderung,
  knappAngemeldet,
  nachMonat,
  technikKurz,
  zusammenfassung,
  type Listeneintrag,
  type ZeitAuswahl,
} from "@/lib/dashboard";
import { datumKurz, datumNumerisch, heuteBerlin, inTagen, monatTitel } from "@/lib/format";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { alleFuerTeam } from "@/lib/server/team-anmeldungen";
import { SelectField, TextField } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Anmeldungen | Technikteam" };

const ZEITEN: { id: ZeitAuswahl; text: string }[] = [
  { id: "anstehend", text: "Anstehend" },
  { id: "vergangen", text: "Vergangen" },
  { id: "alle", text: "Alle" },
];

function eintrag(wert: string | string[] | undefined): string {
  return (Array.isArray(wert) ? wert[0] : wert) ?? "";
}

function plural(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

export default async function Uebersicht({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.lesen" });
  const parameter = await searchParams;
  const zeit: ZeitAuswahl = ["vergangen", "alle"].includes(eintrag(parameter.zeit))
    ? (eintrag(parameter.zeit) as ZeitAuswahl)
    : "anstehend";
  const artWert = eintrag(parameter.art);
  const art = istArt(artWert) ? artWert : "";
  const suche = eintrag(parameter.q).slice(0, 80);

  const heute = heuteBerlin();
  const { anmeldungen, unlesbar } = alleFuerTeam(konto);
  const alle: Listeneintrag[] = anmeldungen;
  const sicht = filtere(alle, { zeit, art: art || undefined, suche }, heute);
  const gruppen = nachMonat(sicht);
  const stand = zusammenfassung(alle, heute);
  const gefiltert = !!(art || suche);

  const link = (neu: Partial<{ zeit: ZeitAuswahl }>) => {
    const p = new URLSearchParams();
    const z = neu.zeit ?? zeit;
    if (z !== "anstehend") p.set("zeit", z);
    if (art) p.set("art", art);
    if (suche) p.set("q", suche);
    const text = p.toString();
    return text ? `/team?${text}` : "/team";
  };

  const saetze = [
    stand.anstehend === 0
      ? "Zurzeit steht keine Veranstaltung an."
      : `${plural(stand.anstehend, "Veranstaltung steht", "Veranstaltungen stehen")} an.`,
    stand.knapp > 0 && `${plural(stand.knapp, "wurde", "wurden")} zu knapp angemeldet.`,
    stand.geaendert > 0 && `${plural(stand.geaendert, "hat", "haben")} Änderungen aus den letzten 7 Tagen.`,
  ].filter(Boolean);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Anmeldungen</h1>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{saetze.join(" ")}</p>

      {unlesbar.length > 0 && (
        <p role="alert" className="mt-5 max-w-[62ch] rounded-md bg-note px-4 py-3 text-sm leading-relaxed text-note-foreground">
          {unlesbar.length === 1 ? "Ein Eintrag lässt" : `${unlesbar.length} Einträge lassen`} sich nicht lesen. Das
          passiert, wenn ein Schlüssel fehlt oder die Datenbank beschädigt ist. Sag dem Superuser Bescheid.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <nav aria-label="Zeitraum" className="-mx-2 flex gap-1">
          {ZEITEN.map((z) => (
            <Link
              key={z.id}
              href={link({ zeit: z.id })}
              aria-current={z.id === zeit ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-[15px] transition-colors hover:bg-muted",
                z.id === zeit ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {z.text}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex w-full flex-wrap items-end gap-3 sm:w-auto" role="search">
          {zeit !== "anstehend" && <input type="hidden" name="zeit" value={zeit} />}
          <TextField
            id="q"
            label="Suchen"
            type="search"
            defaultValue={suche}
            placeholder="Titel, Lehrkraft, Ort"
            className="w-full sm:w-56"
            autoComplete="off"
          />
          <SelectField id="art" label="Art" defaultValue={art} className="w-full sm:w-52">
            <option value="">Alle Arten</option>
            {ARTEN.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="outline" className="h-11 border-input bg-surface px-5 shadow-none">
            Filtern
          </Button>
          {gefiltert && (
            <Link href={zeit !== "anstehend" ? `/team?zeit=${zeit}` : "/team"} className="pb-3 text-sm underline underline-offset-4">
              Zurücksetzen
            </Link>
          )}
        </form>
      </div>

      {sicht.length === 0 ? (
        <Leer insgesamt={alle.length} gefiltert={gefiltert} zeit={zeit} />
      ) : (
        <div className="mt-8 space-y-10">
          {gruppen.map((g) => (
            <section key={g.monat} aria-labelledby={`monat-${g.monat}`}>
              <h2 id={`monat-${g.monat}`} className="mb-1 text-[15px] font-semibold text-muted-foreground">
                {monatTitel(g.monat)}
              </h2>
              <ul className="divide-y divide-border border-y border-border md:-mx-3">
                {g.eintraege.map((e) => (
                  <Zeile key={e.id} e={e} heute={heute} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Leer({ insgesamt, gefiltert, zeit }: { insgesamt: number; gefiltert: boolean; zeit: ZeitAuswahl }) {
  if (insgesamt === 0) {
    return (
      <div className="mt-12 max-w-[56ch]">
        <p className="text-[15px] font-medium">Noch keine Anmeldungen.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sobald eine Lehrkraft das Formular abschickt, steht die Veranstaltung hier. Das Formular erreichst du unter{" "}
          <Link href="/" className="underline underline-offset-4">
            der Startseite
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="mt-12 max-w-[56ch]">
      <p className="text-[15px] font-medium">
        {gefiltert
          ? "Keine Anmeldung passt zu dieser Auswahl."
          : zeit === "anstehend"
            ? "Es steht keine Veranstaltung an."
            : "Hier gibt es nichts zu zeigen."}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {zeit === "anstehend" && !gefiltert
          ? "Unter Vergangen und Alle findest du ältere Anmeldungen."
          : "Ändere den Zeitraum oder die Filter, um mehr zu sehen."}
      </p>
    </div>
  );
}

function Zeile({ e, heute }: { e: Listeneintrag; heute: string }) {
  const v = e.values;
  const knapp = knappAngemeldet(e);
  const aenderung = juengsteAenderung(e, heute);
  const vergangen = v.datum < heute;
  const arten: string[] = v.arten.map((id) => ARTEN.find((a) => a.id === id)?.label ?? id);
  if (v.arten.includes("sonstiges") && v.art_sonstiges.trim()) {
    arten[arten.indexOf("Sonstiges")] = `Sonstiges: ${v.art_sonstiges.trim()}`;
  }
  const felder = aenderung?.felder.map(feldBezeichnung) ?? [];
  const felderText = felder.length > 3 ? `${felder.slice(0, 3).join(", ")} und ${felder.length - 3} weitere` : felder.join(", ");

  return (
    <li className="relative grid gap-x-6 gap-y-3 py-4 transition-colors hover:bg-muted/60 md:grid-cols-[9rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] md:px-3">
      <div className="text-sm">
        <p className="font-medium tabular-nums">{datumKurz(v.datum)}</p>
        <p className="tabular-nums text-muted-foreground">
          {v.beginn} bis {v.ende} Uhr
        </p>
        {!vergangen && <p className="text-muted-foreground">{inTagen(v.datum, heute)}</p>}
      </div>

      <div className="min-w-0">
        <Link
          href={`/team/anmeldungen/${e.id}`}
          className="text-[15px] font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/40 focus-visible:after:rounded-md"
        >
          {v.titel}
        </Link>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {v.lehrkraft} · {v.ort}
        </p>
        <p className="mt-0.5 text-sm">{arten.length > 0 ? arten.join(", ") : <span className="text-muted-foreground">Art nicht angegeben</span>}</p>
      </div>

      <div className="text-sm">
        <p>{technikKurz(v)}</p>
        <p className="mt-0.5 text-muted-foreground">{betreuungKurz(v)}</p>
      </div>

      <div className="text-sm">
        {knapp && (
          <p className="font-medium text-note-foreground">
            Zu knapp angemeldet, {knapp.vorhanden} von {knapp.noetig} Tagen
          </p>
        )}
        <p className={cn(e.dateien.length === 0 && "text-muted-foreground")}>
          {e.dateien.length === 0
            ? "Keine Unterlagen"
            : e.dateien.length === 1
              ? "1 Datei"
              : `${e.dateien.length} Dateien`}
        </p>
        {aenderung && (
          <p className="mt-0.5 text-muted-foreground">
            Geändert am {datumNumerisch(aenderung.zeit)}: {felderText}
          </p>
        )}
      </div>
    </li>
  );
}
