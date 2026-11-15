import { Suspense, type ReactNode } from "react";
import { TeamShell } from "./team-shell";

/**
 * Der Rahmen (Breite, weißes Blatt) steht schon im statischen Teil. Wer angemeldet ist und
 * welche Menüpunkte es gibt, kommt erst mit der Anfrage dazu und wird nachgereicht.
 */
function Rahmen() {
  return (
    <div className="mx-auto w-full max-w-[64rem] px-3 pb-20 sm:px-6">
      <div className="h-[4.5rem] sm:h-[5rem]" />
      <div className="min-h-72 rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]" />
    </div>
  );
}

export default function AngemeldetLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Rahmen />}>
      <TeamShell>{children}</TeamShell>
    </Suspense>
  );
}
