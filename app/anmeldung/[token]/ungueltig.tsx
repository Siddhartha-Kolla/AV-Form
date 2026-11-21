import Link from "next/link";

export function UngueltigerLink() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dieser Link ist nicht gültig</h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
        Vielleicht fehlt ein Stück des Links, oder er wurde durch einen neueren ersetzt. Öffnen Sie bitte den Link aus der
        letzten E-Mail des Technikteams. Haben Sie die E-Mail nicht mehr, lassen Sie sich neue Links schicken.
      </p>
      <Link
        href="/anmeldung/link-verloren"
        className="mt-6 inline-flex h-11 items-center rounded-md border border-input bg-surface px-5 text-[15px] font-medium transition-colors hover:border-foreground/50"
      >
        Neue Links anfordern
      </Link>
    </div>
  );
}
