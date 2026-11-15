import { Suspense } from "react";
import { Laden } from "@/components/laden";
import { alsListeneintrag, istArt, zusammenfassung, type ZeitAuswahl } from "@/lib/dashboard";
import { heuteBerlin } from "@/lib/format";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { alleFuerTeam } from "@/lib/server/team-anmeldungen";
import { UebersichtListe } from "./uebersicht-liste";

export const metadata = { title: "Anmeldungen | Technikteam" };

function eintrag(wert: string | string[] | undefined): string {
  return (Array.isArray(wert) ? wert[0] : wert) ?? "";
}

function plural(n: number, einzahl: string, mehrzahl: string): string {
  return `${n} ${n === 1 ? einzahl : mehrzahl}`;
}

async function UebersichtInhalt({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.lesen" });
  const parameter = await searchParams;
  const zeitWert = eintrag(parameter.zeit);
  const zeit: ZeitAuswahl = zeitWert === "vergangen" || zeitWert === "alle" ? zeitWert : "anstehend";
  const artWert = eintrag(parameter.art);
  const art = istArt(artWert) ? artWert : "";
  const suche = eintrag(parameter.q).slice(0, 80);

  const heute = heuteBerlin();
  const { anmeldungen, unlesbar } = alleFuerTeam(konto);
  // Nur die Felder der Liste gehen an den Browser, der Rest bleibt auf dem Server.
  const eintraege = anmeldungen.map(alsListeneintrag);
  const stand = zusammenfassung(eintraege, heute);

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

      <UebersichtListe eintraege={eintraege} heute={heute} start={{ zeit, art, suche }} />
    </div>
  );
}

export default function Uebersicht({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<Laden />}>
      <UebersichtInhalt searchParams={searchParams} />
    </Suspense>
  );
}
