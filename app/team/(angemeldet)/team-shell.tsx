import type { ReactNode } from "react";
import { darf, ROLLEN } from "@/lib/berechtigungen";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { TeamKopf, type NavEintrag } from "@/components/team-kopf";
import { cn } from "@/lib/utils";
import { abmeldenAktion } from "./actions";

export async function TeamShell({ children }: { children: ReactNode }) {
  const { konto } = await verlangeSitzung({ passwortWechsel: true });

  // Bereiche der Arbeit. "Mein Konto" liegt im Konto-Menü, nicht in der Navigation.
  const eintraege: NavEintrag[] = konto.mussPasswortAendern
    ? []
    : [
        ...(darf(konto.rolle, "anmeldungen.lesen")
          ? [{ href: "/team", text: "Anmeldungen", symbol: "anmeldungen" as const, exakt: true, auchBei: ["/team/anmeldungen"] }]
          : []),
        ...(darf(konto.rolle, "team.verwalten")
          ? [{ href: "/team/mitglieder", text: "Mitglieder", symbol: "mitglieder" as const }]
          : []),
        ...(darf(konto.rolle, "protokoll.lesen")
          ? [{ href: "/team/protokoll", text: "Protokoll", symbol: "protokoll" as const }]
          : []),
      ];

  return (
    <>
      <TeamKopf
        eintraege={eintraege}
        name={konto.anzeigename}
        rolle={ROLLEN[konto.rolle].name}
        kontoId={konto.id}
        bildVersion={konto.bildVersion}
        abmelden={abmeldenAktion}
      />
      <div
        className={cn(
          "mx-auto w-full max-w-[64rem] px-3 pt-5 sm:px-6 sm:pt-8",
          // Auf dem Handy steht unten eine Navigationsleiste, die nichts verdecken darf.
          eintraege.length >= 2 ? "pb-28 sm:pb-20" : "pb-20",
        )}
      >
        <main className="rounded-lg border border-border bg-surface px-5 py-8 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:px-10 sm:py-10">
          {children}
        </main>
      </div>
    </>
  );
}
