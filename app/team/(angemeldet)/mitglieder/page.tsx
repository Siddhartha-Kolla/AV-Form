import { Avatar } from "@/components/avatar";
import { Laden } from "@/components/laden";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { darfKontoVerwalten, ROLLEN, vergebbareRollen } from "@/lib/berechtigungen";
import { datumZeit } from "@/lib/format";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { listeKonten, type Konto } from "@/lib/server/auth/konten";
import { zaehleSitzungen } from "@/lib/server/auth/sitzungen";
import { MitgliedAnlegen, MitgliedVerwalten } from "./mitglieder-ui";

export const metadata = { title: "Mitglieder | Technikteam" };

/** Der Zustand eines Kontos, nur wenn er auffällt. Ein normales, aktives Konto bekommt keine Markierung. */
function Zustand({ m }: { m: Konto }) {
  if (m.status === "gesperrt") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
        Gesperrt
      </p>
    );
  }
  if (m.mussPasswortAendern) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Startpasswort offen
      </p>
    );
  }
  return null;
}

async function MitgliederInhalt() {
  const { konto } = await verlangeSitzung({ berechtigung: "team.verwalten" });
  const mitglieder = listeKonten();
  const rollen = vergebbareRollen(konto.rolle);
  const gesperrt = mitglieder.filter((m) => m.status === "gesperrt").length;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mitglieder</h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            Hier legst du Mitglieder an, vergibst Startpasswörter und setzt Zugänge zurück. Jede Änderung steht im
            Protokoll.
          </p>
        </div>
        <MitgliedAnlegen rollen={rollen} />
      </div>

      <p className="mb-2 text-sm text-muted-foreground">
        {mitglieder.length} {mitglieder.length === 1 ? "Konto" : "Konten"}
        {gesperrt > 0 && `, davon ${gesperrt} gesperrt`}
      </p>

      <div className="border-t border-border">
        {/* Spaltenköpfe nur dort, wo die Zeilen wirklich Spalten sind. */}
        <div
          aria-hidden="true"
          className="hidden gap-x-6 border-b border-border py-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_12rem]"
        >
          <span>Name</span>
          <span>Rolle</span>
          <span>Letzte Anmeldung</span>
          <span />
        </div>
        <ul className="divide-y divide-border border-b border-border">
          {mitglieder.map((m) => {
            const verwaltbar = darfKontoVerwalten(konto.rolle, m.rolle) && m.rolle !== "superuser";
            return (
              <li
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 py-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_12rem]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    id={m.id}
                    name={m.anzeigename}
                    version={m.bildVersion}
                    className={`size-10 text-sm ${m.status === "gesperrt" ? "opacity-60" : ""}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">
                      {m.anzeigename}
                      {m.id === konto.id && <span className="ml-2 text-sm font-normal text-muted-foreground">du</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      @{m.benutzername}
                      {m.email && <span className="max-sm:hidden"> · {m.email}</span>}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 pl-[3.25rem] text-sm sm:col-span-1 sm:pl-0">
                  <p>{ROLLEN[m.rolle].name}</p>
                  <Zustand m={m} />
                </div>

                <p className="col-span-2 pl-[3.25rem] text-sm text-muted-foreground sm:col-span-1 sm:pl-0">
                  {m.letzterLogin ? (
                    <>
                      <span className="sm:hidden">Zuletzt angemeldet: </span>
                      {datumZeit(m.letzterLogin)}
                    </>
                  ) : (
                    "Noch nie angemeldet"
                  )}
                </p>

                <div className="col-start-2 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto">
                  {!verwaltbar ? (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="whitespace-nowrap max-sm:sr-only">
                        {m.rolle === "superuser" ? "Nur per Kommandozeile" : m.id === konto.id ? "Eigenes Konto" : "Nur der Superuser"}
                      </span>
                    </span>
                  ) : (
                    <MitgliedVerwalten
                      rollen={rollen}
                      m={{
                        id: m.id,
                        benutzername: m.benutzername,
                        anzeigename: m.anzeigename,
                        email: m.email,
                        rolle: m.rolle,
                        gesperrt: m.status === "gesperrt",
                        mussPasswortAendern: m.mussPasswortAendern,
                        sitzungen: zaehleSitzungen(m.id),
                        letzteAnmeldung: m.letzterLogin ? datumZeit(m.letzterLogin) : null,
                      }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {mitglieder.length === 1 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Bisher gibt es nur dein Konto. Lege mit „Mitglied anlegen“ die ersten Teammitglieder an.
        </p>
      )}
    </div>
  );
}

export default function MitgliederSeite() {
  return (
    <Suspense fallback={<Laden />}>
      <MitgliederInhalt />
    </Suspense>
  );
}
