import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AnmeldungBearbeiten } from "@/components/anmeldung-bearbeiten";
import { Laden } from "@/components/laden";
import { verlangeSitzung } from "@/lib/server/auth/dal";
import { ladeZumBearbeiten } from "@/lib/server/team-anmeldungen";

export const metadata = { title: "Anmeldung bearbeiten | Technikteam" };

async function BearbeitenInhalt({ params }: { params: Promise<{ id: string }> }) {
  const { konto } = await verlangeSitzung({ berechtigung: "anmeldungen.bearbeiten" });
  const { id } = await params;
  const geladen = ladeZumBearbeiten(konto, id);
  if (!geladen) notFound();

  return (
    <AnmeldungBearbeiten
      modus="team"
      speichernUrl={`/team/anmeldungen/${geladen.anmeldung.id}/speichern`}
      zurueck={`/team/anmeldungen/${geladen.anmeldung.id}`}
      revision={geladen.anmeldung.revision}
      start={geladen.anmeldung.values}
      dateien={geladen.dateien}
    />
  );
}

export default function BearbeitenSeite({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Laden />}>
      <BearbeitenInhalt params={params} />
    </Suspense>
  );
}
