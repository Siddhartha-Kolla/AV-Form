import Link from "next/link";
import { datumZeitMitSekunden, geraetKurz } from "@/lib/format";
import { GRUPPEN, ereignisseDerGruppe, ereignisText, type GruppeId } from "@/lib/protokoll-ereignisse";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { listeProtokoll, protokollAkteure, type ProtokollZeile } from "@/lib/server/auth/protokoll";
import { SelectField } from "@/components/fields";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Protokoll | Technikteam" };

const DETAIL_NAMEN: Record<string, string> = {
  anbieter: "Anbieter",
  benutzername: "Benutzername",
  felder: "Felder",
  rolle: "Rolle",
  anzahl: "Anzahl",
  sitzungenBeendet: "Sitzungen beendet",
  andereSitzungenBeendet: "Andere Sitzungen beendet",
  hinweis: "Hinweis",
};

function detailText(z: ProtokollZeile): string {
  const teile = Object.entries(z.details).map(([k, v]) => {
    const wert = Array.isArray(v) ? v.join(", ") : String(v);
    return `${DETAIL_NAMEN[k] ?? k}: ${wert}`;
  });
  return teile.join(" · ");
}

function eintrag(wert: string | string[] | undefined): string {
  return (Array.isArray(wert) ? wert[0] : wert) ?? "";
}

export default async function ProtokollSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await verlangeSitzung({ berechtigung: "protokoll.lesen" });
  const parameter = await searchParams;
  const gruppe = eintrag(parameter.gruppe);
  const person = eintrag(parameter.person);
  const vor = Number(eintrag(parameter.vor)) || undefined;
  const gueltigeGruppe = gruppe in GRUPPEN ? (gruppe as GruppeId) : undefined;

  const { zeilen, hatMehr } = listeProtokoll({
    ereignisse: gueltigeGruppe ? ereignisseDerGruppe(gueltigeGruppe) : undefined,
    akteurId: person || undefined,
    vorId: vor,
    limit: 50,
  });
  const akteure = protokollAkteure();

  const weiter = new URLSearchParams();
  if (gueltigeGruppe) weiter.set("gruppe", gueltigeGruppe);
  if (person) weiter.set("person", person);
  if (hatMehr) weiter.set("vor", String(zeilen[zeilen.length - 1].id));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Protokoll</h1>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
        Wer sich wann angemeldet und was am Team geändert hat. Einträge werden nach der festgelegten Frist automatisch
        gelöscht.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-4">
        <SelectField id="gruppe" label="Bereich" defaultValue={gueltigeGruppe ?? ""} className="w-60">
          <option value="">Alles</option>
          {(Object.keys(GRUPPEN) as GruppeId[]).map((g) => (
            <option key={g} value={g}>
              {GRUPPEN[g]}
            </option>
          ))}
        </SelectField>
        <SelectField id="person" label="Person" defaultValue={person} className="w-60">
          <option value="">Alle</option>
          {akteure.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="outline" className="h-11 border-input bg-surface px-5 shadow-none">
          Filtern
        </Button>
        {(gueltigeGruppe || person) && (
          <Link href="/team/protokoll" className="pb-3 text-sm underline underline-offset-4">
            Zurücksetzen
          </Link>
        )}
      </form>

      {zeilen.length === 0 ? (
        <p className="mt-10 text-muted-foreground">Für diese Auswahl gibt es keine Einträge.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <caption className="sr-only">Protokoll, neueste Einträge zuerst</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Zeit</th>
                <th scope="col" className="py-2 pr-4 font-medium">Ereignis</th>
                <th scope="col" className="py-2 pr-4 font-medium">Person</th>
                <th scope="col" className="py-2 pr-4 font-medium">Betrifft</th>
                <th scope="col" className="py-2 font-medium">Einzelheiten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border align-top">
              {zeilen.map((z) => {
                const einzelheiten = [detailText(z), z.ip && `IP ${z.ip}`, z.geraet && geraetKurz(z.geraet)].filter(Boolean).join(" · ");
                return (
                  <tr key={z.id}>
                    <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-muted-foreground">
                      {datumZeitMitSekunden(z.zeit)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={z.ergebnis === "fehler" ? "text-destructive" : undefined}>
                        {ereignisText(z.ereignis)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">{z.akteurName ?? <span className="text-muted-foreground">unbekannt</span>}</td>
                    <td className="whitespace-nowrap py-3 pr-4">{z.zielName ?? ""}</td>
                    <td className="max-w-[24rem] py-3 text-muted-foreground">{einzelheiten}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hatMehr && (
        <Link
          href={`/team/protokoll?${weiter.toString()}`}
          className="mt-6 inline-block text-[15px] font-medium underline underline-offset-4"
        >
          Ältere Einträge
        </Link>
      )}
    </div>
  );
}
