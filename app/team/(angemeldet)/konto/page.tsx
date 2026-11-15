import { Laden } from "@/components/laden";
import { Suspense } from "react";
import { ROLLEN } from "@/lib/berechtigungen";
import { datumZeit, geraetKurz } from "@/lib/format";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { listeSitzungen } from "@/lib/server/auth/sitzungen";
import { AndereSitzungenBeenden, PasswortAendern } from "./konto-forms";

export const metadata = { title: "Mein Konto | Technikteam" };

async function KontoInhalt() {
  const { konto, sitzungId } = await verlangeSitzung({ passwortWechsel: true });
  const sitzungen = listeSitzungen(konto.id);
  const andere = sitzungen.filter((s) => s.id !== sitzungId);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mein Konto</h1>
        <dl className="mt-5 grid max-w-md grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-[15px]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{konto.anzeigename}</dd>
          <dt className="text-muted-foreground">Benutzername</dt>
          <dd>{konto.benutzername}</dd>
          <dt className="text-muted-foreground">Rolle</dt>
          <dd>{ROLLEN[konto.rolle].name}</dd>
          <dt className="text-muted-foreground">Letzter Login</dt>
          <dd>{konto.letzterLogin ? datumZeit(konto.letzterLogin) : "Das ist dein erster Login."}</dd>
        </dl>
      </div>

      <section aria-labelledby="passwort-titel">
        <h2 id="passwort-titel" className="mb-2 text-xl font-semibold tracking-tight">
          Passwort ändern
        </h2>
        {konto.mussPasswortAendern && (
          <p className="mb-5 max-w-[60ch] rounded-md bg-note px-4 py-3 text-sm leading-relaxed text-note-foreground">
            Dein Passwort wurde für dich vergeben. Bitte wähle jetzt ein eigenes, danach geht es weiter.
          </p>
        )}
        <PasswortAendern />
      </section>

      {!konto.mussPasswortAendern && (
        <section aria-labelledby="sitzungen-titel">
          <h2 id="sitzungen-titel" className="mb-4 text-xl font-semibold tracking-tight">
            Angemeldete Geräte
          </h2>
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
        </section>
      )}
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
