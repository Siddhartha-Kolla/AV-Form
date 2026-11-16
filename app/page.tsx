import Link from "next/link";
import { RegistrationForm } from "@/components/registration-form";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[48rem] px-3 pb-20 sm:px-6 xl:max-w-[72rem]">
      <div className="flex items-center justify-between gap-4 px-2 py-6 sm:py-8">
        <p className="text-[15px] font-semibold tracking-tight">Technikteam</p>
        {/* Wer schon angemeldet ist, kommt direkt in die Übersicht, alle anderen zur Anmeldung. */}
        <Link
          href="/team"
          className="rounded-md px-2 py-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Zum Teambereich
        </Link>
      </div>
      <RegistrationForm />
    </div>
  );
}
