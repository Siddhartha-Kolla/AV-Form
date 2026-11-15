import { Suspense } from "react";
import { redirect } from "next/navigation";
import "@/lib/server/auth/anbieter-register";
import { aktiveAnbieter } from "@/lib/server/auth/anbieter";
import { aktuelleSitzung } from "@/lib/server/auth/dal";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden | Technikteam" };

export default function LoginSeite() {
  return (
    <div className="mx-auto w-full max-w-[28rem] px-3 pb-20 sm:px-6">
      <p className="px-2 py-6 text-[15px] font-semibold tracking-tight sm:py-8">Technikteam</p>
      <main className="rounded-lg border border-border bg-surface px-5 py-9 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-10 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
        <p className="mt-2 mb-8 text-sm leading-relaxed text-muted-foreground">
          Dieser Bereich ist für Mitglieder des Technikteams.
        </p>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Einen Moment.</p>}>
          <Anmeldung />
        </Suspense>
      </main>
    </div>
  );
}

async function Anmeldung() {
  if (await aktuelleSitzung()) redirect("/team");
  const anbieter = aktiveAnbieter();
  const weiterleitungen = anbieter.filter((a) => a.art === "weiterleitung");

  return (
    <div className="space-y-6">
      {anbieter.some((a) => a.id === "passwort") && <LoginForm />}
      {weiterleitungen.length > 0 && (
        <ul className="space-y-2">
          {weiterleitungen.map((a) => (
            <li key={a.id}>
              <a
                href={`/team/login/${a.id}`}
                className="flex h-11 items-center justify-center rounded-md border border-input bg-surface text-[15px] font-medium transition-colors hover:border-foreground/50"
              >
                Weiter mit {a.anzeige}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
