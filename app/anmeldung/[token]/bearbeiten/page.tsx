import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AnmeldungBearbeiten } from "@/components/anmeldung-bearbeiten";
import { Laden } from "@/components/laden";
import { ladeFuerLehrkraft } from "@/lib/server/lehrkraft";
import { UngueltigerLink } from "../ungueltig";

async function BearbeitenInhalt({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const ansicht = ladeFuerLehrkraft(token);
  if (!ansicht) return <UngueltigerLink />;

  if (!ansicht.kannAendern) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ändern nicht möglich</h1>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">{ansicht.grund}</p>
        <Link href={`/anmeldung/${token}`} className="mt-6 inline-block text-sm underline underline-offset-4">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <AnmeldungBearbeiten
      modus="lehrkraft"
      speichernUrl={`/anmeldung/${token}/speichern`}
      zurueck={`/anmeldung/${token}`}
      revision={ansicht.anmeldung.revision}
      start={ansicht.anmeldung.values}
      dateien={ansicht.dateien}
    />
  );
}

export default function BearbeitenSeite({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Laden />}>
      <BearbeitenInhalt params={params} />
    </Suspense>
  );
}
