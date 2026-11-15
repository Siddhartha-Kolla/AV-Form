import type { ReactNode } from "react";
import { darf } from "@/lib/berechtigungen";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { TeamNav, type NavEintrag } from "@/components/team-nav";
import { abmeldenAktion } from "./actions";

export async function TeamShell({ children }: { children: ReactNode }) {
  const { konto } = await verlangeSitzung({ passwortWechsel: true });

  const eintraege: NavEintrag[] = konto.mussPasswortAendern
    ? []
    : [
        ...(darf(konto.rolle, "anmeldungen.lesen")
          ? [{ href: "/team", text: "Anmeldungen", exakt: true, auchBei: ["/team/anmeldungen"] }]
          : []),
        ...(darf(konto.rolle, "team.verwalten") ? [{ href: "/team/mitglieder", text: "Mitglieder" }] : []),
        ...(darf(konto.rolle, "protokoll.lesen") ? [{ href: "/team/protokoll", text: "Protokoll" }] : []),
        { href: "/team/konto", text: "Mein Konto" },
      ];

  return (
    <div className="mx-auto w-full max-w-[64rem] px-3 pb-20 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-2 py-5 sm:py-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <p className="text-[15px] font-semibold tracking-tight">Technikteam</p>
          <TeamNav eintraege={eintraege} />
        </div>
        <form action={abmeldenAktion} className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{konto.anzeigename}</span>
          <button
            type="submit"
            className="rounded-md px-2 py-1.5 font-medium underline decoration-muted-foreground underline-offset-4 hover:decoration-foreground"
          >
            Abmelden
          </button>
        </form>
      </header>
      <main className="rounded-lg border border-border bg-surface px-5 py-8 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-10 sm:py-10">
        {children}
      </main>
    </div>
  );
}
