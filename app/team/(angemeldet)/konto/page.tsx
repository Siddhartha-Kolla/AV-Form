import { Laden } from "@/components/laden";
import { Suspense, type ReactNode } from "react";
import { ROLLEN, darf } from "@/lib/berechtigungen";
import { datumZeit, geraetKurz } from "@/lib/format";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { listeSitzungen } from "@/lib/server/auth/sitzungen";
import { appUrl } from "@/lib/server/config";
import { ladeKalenderLink } from "@/lib/server/kalender";
import { Kalender } from "./kalender";
import { AndereSitzungenBeenden, PasswortAendern } from "./konto-forms";
import { ProfilBild } from "./profilbild";

export const metadata = { title: "Mein Konto | Technikteam" };

/** Ein Bereich der Seite: links, worum es geht, rechts der Inhalt. Auf schmalen Bildschirmen untereinander. */
function Bereich({ id, titel, text, children }: { id: string; titel: string; text?: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-x-12 gap-y-5 border-t border-border pt-9 first:border-t-0 first:pt-0 lg:grid-cols-[13rem_minmax(0,1fr)]"
    >
      <div>
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {titel}
        </h2>
        {text && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

async function KontoInhalt() {
  const { konto, sitzungId } = await verlangeSitzung({ passwortWechsel: true });
  const sitzungen = listeSitzungen(konto.id);
  const andere = sitzungen.filter((s) => s.id !== sitzungId);
  const basis = appUrl();
  const kalender = !konto.mussPasswortAendern && darf(konto.rolle, "anmeldungen.lesen") ? ladeKalenderLink(konto) : null;

  return (
    <div>
      <h1 className="mb-9 text-2xl font-semibold tracking-tight">Mein Konto</h1>

      <div className="space-y-9">
        <Bereich id="profil-titel" titel="Profil" text="So erscheinst du im Team.">
          <ProfilBild id={konto.id} name={konto.anzeigename} version={konto.bildVersion} />
          <dl className="mt-7 grid max-w-xl gap-x-8 gap-y-4 text-[15px] sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="mt-0.5">{konto.anzeigename}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Benutzername</dt>
              <dd className="mt-0.5">{konto.benutzername}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Rolle</dt>
              <dd className="mt-0.5">{ROLLEN[konto.rolle].name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Letzter Login</dt>
              <dd className="mt-0.5">{konto.letzterLogin ? datumZeit(konto.letzterLogin) : "Das ist dein erster Login."}</dd>
            </div>
          </dl>
        </Bereich>

        <Bereich
          id="passwort-titel"
          titel="Passwort"
          text="Mindestens 12 Zeichen. Beim Ändern enden alle anderen Sitzungen."
        >
          {konto.mussPasswortAendern && (
            <p className="mb-5 max-w-[60ch] rounded-md bg-note px-4 py-3 text-sm leading-relaxed text-note-foreground">
              Dein Passwort wurde für dich vergeben. Bitte wähle jetzt ein eigenes, danach geht es weiter.
            </p>
          )}
          <PasswortAendern />
        </Bereich>

        {!konto.mussPasswortAendern && darf(konto.rolle, "anmeldungen.lesen") && (
          <Bereich id="kalender-titel" titel="Kalender" text="Veranstaltungen automatisch im eigenen Kalender.">
            {basis ? (
              <Kalender
                links={
                  kalender
                    ? {
                        alle: `${basis}/kalender/${kalender.token}/alle.ics`,
                        meine: `${basis}/kalender/${kalender.token}/meine.ics`,
                      }
                    : null
                }
                zuletzt={kalender?.zuletztAbgerufen ?? null}
                kannMeine={konto.rolle !== "superuser"}
              />
            ) : (
              <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
                Für den Kalender muss die Adresse der Seite eingetragen sein. Bitte sag dem Superuser, dass APP_URL gesetzt werden muss.
              </p>
            )}
          </Bereich>
        )}

        {!konto.mussPasswortAendern && (
          <Bereich id="sitzungen-titel" titel="Angemeldete Geräte" text="Hier siehst du, wo du gerade angemeldet bist.">
            <ul className="mb-5 max-w-2xl divide-y divide-border border-y border-border">
              {sitzungen.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 text-[15px]">
                  <span className="min-w-0 truncate">
                    {geraetKurz(s.geraet)}
                    {s.id === sitzungId && <span className="ml-2 text-sm text-muted-foreground">diese Sitzung</span>}
                  </span>
                  <span className="text-sm text-muted-foreground">Zuletzt aktiv {datumZeit(s.zuletztAktiv)}</span>
                </li>
              ))}
            </ul>
            {andere.length > 0 && <AndereSitzungenBeenden />}
          </Bereich>
        )}
      </div>
    </div>
  );
}

export default function KontoSeite() {
  return (
    <Suspense fallback={<Laden />}>
      <KontoInhalt />
    </Suspense>
  );
}
