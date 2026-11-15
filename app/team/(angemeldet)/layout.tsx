import { Suspense, type ReactNode } from "react";
import { TeamShell } from "./team-shell";

export default function AngemeldetLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Einen Moment.</p>}>
      <TeamShell>{children}</TeamShell>
    </Suspense>
  );
}
