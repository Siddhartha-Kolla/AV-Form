import { ROLLEN } from "@/lib/berechtigungen";
import { datumZeit } from "@/lib/format";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { listeKonten } from "@/lib/server/auth/konten";
import { zaehleSitzungen } from "@/lib/server/auth/sitzungen";
import { MitgliedAnlegen, MitgliedVerwalten } from "./mitglieder-ui";

export const metadata = { title: "Mitglieder | Technikteam" };

export default async function MitgliederSeite() {
  const { konto } = await verlangeSitzung({ berechtigung: "team.verwalten" });
  const mitglieder = listeKonten();

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
        <MitgliedAnlegen />
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {mitglieder.map((m) => {
          const istSuperuser = m.rolle === "superuser";
          return (
            <li key={m.id} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_12rem_9rem] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">
                  {m.anzeigename}
                  {m.id === konto.id && <span className="ml-2 text-sm font-normal text-muted-foreground">du</span>}
                </p>
                <p className="truncate text-sm text-muted-foreground">@{m.benutzername}</p>
              </div>
              <div className="text-sm">
                <p>{ROLLEN[m.rolle].name}</p>
                {m.status === "gesperrt" && <p className="text-destructive">Gesperrt</p>}
                {m.status === "aktiv" && m.mussPasswortAendern && (
                  <p className="text-muted-foreground">Startpasswort offen</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {m.letzterLogin ? `Zuletzt ${datumZeit(m.letzterLogin)}` : "Noch nie angemeldet"}
              </p>
              <div className="sm:justify-self-end">
                {istSuperuser ? (
                  <span className="text-sm text-muted-foreground">Nur per Kommandozeile</span>
                ) : (
                  <MitgliedVerwalten
                    m={{
                      id: m.id,
                      benutzername: m.benutzername,
                      anzeigename: m.anzeigename,
                      email: m.email,
                      rolle: m.rolle,
                      gesperrt: m.status === "gesperrt",
                      mussPasswortAendern: m.mussPasswortAendern,
                      sitzungen: zaehleSitzungen(m.id),
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {mitglieder.length === 1 && (
        <p className="mt-6 text-sm text-muted-foreground">
          Bisher gibt es nur dein Konto. Lege mit Mitglied anlegen die ersten Teammitglieder an.
        </p>
      )}
    </div>
  );
}
