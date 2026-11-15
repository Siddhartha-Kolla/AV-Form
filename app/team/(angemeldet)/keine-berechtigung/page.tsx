import Link from "next/link";

export const metadata = { title: "Keine Berechtigung | Technikteam" };

export default function KeineBerechtigung() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dafür fehlt dir die Berechtigung</h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
        Diese Seite ist für eine andere Rolle gedacht. Wenn du sie brauchst, sprich den Superuser an.
      </p>
      <Link href="/team" className="mt-6 inline-block text-[15px] font-medium underline underline-offset-4">
        Zurück zum Start
      </Link>
    </div>
  );
}
