"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronDown, LogOut, ScrollText, User, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

export type NavSymbol = "anmeldungen" | "mitglieder" | "protokoll";

export type NavEintrag = {
  href: string;
  text: string;
  symbol: NavSymbol;
  /** Nur bei genau diesem Pfad aktiv. */
  exakt?: boolean;
  /** Zusätzliche Pfade, bei denen der Eintrag auch aktiv ist. */
  auchBei?: string[];
};

const SYMBOLE = { anmeldungen: CalendarDays, mitglieder: Users, protokoll: ScrollText } as const;

function istAktiv(pfad: string, e: NavEintrag): boolean {
  return (
    pfad === e.href ||
    (!e.exakt && pfad.startsWith(`${e.href}/`)) ||
    (e.auchBei ?? []).some((p) => pfad === p || pfad.startsWith(`${p}/`))
  );
}

/**
 * Kopfleiste des Teambereichs.
 * - Ab 640 Pixeln stehen die Bereiche als Reiter oben, der aktive trägt eine Linie in der Akzentfarbe.
 * - Auf dem Handy steht eine Leiste unten, in Daumenreichweite. Oben bleibt nur der Name und das Konto-Menü.
 * - Die Kopfleiste bleibt beim Scrollen stehen.
 */
export function TeamKopf({
  eintraege,
  name,
  rolle,
  kontoId,
  bildVersion,
  abmelden,
}: {
  eintraege: NavEintrag[];
  name: string;
  rolle: string;
  kontoId: string;
  bildVersion: string | null;
  abmelden: () => Promise<void>;
}) {
  const pfad = usePathname();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[64rem] items-center gap-4 px-3 sm:gap-8 sm:px-6">
          <Link href="/team" className="rounded-md text-[15px] font-semibold tracking-tight">
            Technikteam
          </Link>

          <nav aria-label="Hauptnavigation" className="-mb-px hidden h-full sm:flex">
            {eintraege.map((e) => {
              const aktiv = istAktiv(pfad, e);
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={cn(
                    "relative flex h-full items-center px-3 text-[15px] transition-colors",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:transition-opacity",
                    aktiv
                      ? "font-medium text-foreground after:opacity-100"
                      : "text-muted-foreground after:opacity-0 hover:text-foreground hover:after:bg-border hover:after:opacity-100",
                  )}
                >
                  {e.text}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto">
            <KontoMenue name={name} rolle={rolle} kontoId={kontoId} bildVersion={bildVersion} abmelden={abmelden} />
          </div>
        </div>
      </header>

      {eintraege.length >= 2 && (
        <nav
          aria-label="Hauptnavigation"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${eintraege.length}, minmax(0, 1fr))` }}>
            {eintraege.map((e) => {
              const aktiv = istAktiv(pfad, e);
              const Symbol = SYMBOLE[e.symbol];
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    aria-current={aktiv ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors",
                      aktiv ? "font-medium text-primary" : "text-muted-foreground active:text-foreground",
                    )}
                  >
                    <Symbol className="size-5" strokeWidth={aktiv ? 2 : 1.5} aria-hidden="true" />
                    {e.text}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

/** Konto-Menü: Name, Rolle, Mein Konto, Abmelden. Schließt bei Klick daneben, mit Escape und beim Seitenwechsel. */
function KontoMenue({
  name,
  rolle,
  kontoId,
  bildVersion,
  abmelden,
}: {
  name: string;
  rolle: string;
  kontoId: string;
  bildVersion: string | null;
  abmelden: () => Promise<void>;
}) {
  const pfad = usePathname();
  // Das Menü merkt sich die Seite, auf der es geöffnet wurde. Ein Seitenwechsel schließt es damit von selbst.
  const [offenBei, setOffenBei] = useState<string | null>(null);
  const offen = offenBei === pfad;
  const wurzel = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!offen) return;
    const daneben = (e: PointerEvent) => {
      if (!wurzel.current?.contains(e.target as Node)) setOffenBei(null);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffenBei(null);
        knopf.current?.focus();
      }
    };
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  const eintrag =
    "flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-[15px] transition-colors hover:bg-muted";

  return (
    <div
      ref={wurzel}
      className="relative"
      onBlur={(e) => {
        if (offen && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOffenBei(null);
      }}
    >
      <button
        ref={knopf}
        type="button"
        aria-expanded={offen}
        aria-label={`Konto-Menü von ${name}`}
        onClick={() => setOffenBei(offen ? null : pfad)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-muted",
          offen && "bg-muted",
        )}
      >
        <Avatar id={kontoId} name={name} version={bildVersion} className="size-8 text-xs" />
        <span className="hidden max-w-40 truncate text-sm lg:inline">{name}</span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform duration-150", offen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {offen && (
        <div
          role="group"
          aria-label="Konto"
          className="menue-ein absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-[15px] font-medium">{name}</p>
            <p className="text-sm text-muted-foreground">{rolle}</p>
          </div>
          <div className="my-1 h-px bg-border" role="separator" />
          <Link href="/team/konto" className={eintrag}>
            <User className="size-4 text-muted-foreground" aria-hidden="true" />
            Mein Konto
          </Link>
          <form action={abmelden}>
            <button type="submit" className={eintrag}>
              <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
