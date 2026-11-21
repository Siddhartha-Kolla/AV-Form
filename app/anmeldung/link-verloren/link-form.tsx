"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { TextField } from "@/components/fields";
import { Button } from "@/components/ui/button";

export function LinkForm() {
  const [email, setEmail] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  // Schutz vor Programmen: ein verstecktes Feld und der Zeitpunkt, an dem das Formular erschien.
  const falle = useRef<HTMLInputElement>(null);
  const gestartet = useRef(0);
  useEffect(() => {
    gestartet.current = Date.now();
  }, []);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    if (laeuft) return;
    setFehler(null);
    setLaeuft(true);
    try {
      const antwort = await fetch("/anmeldung/link-verloren/anfordern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, webseite: falle.current?.value ?? "", gestartet: gestartet.current }),
      });
      const daten = (await antwort.json().catch(() => null)) as { ok?: boolean; meldung?: string } | null;
      if (daten?.ok) setGesendet(true);
      else setFehler(daten?.meldung ?? "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.");
    } catch {
      setFehler("Es gab keine Verbindung. Bitte versuchen Sie es noch einmal.");
    } finally {
      setLaeuft(false);
    }
  }

  if (gesendet) {
    return (
      <div role="status">
        <h1 className="text-2xl font-semibold tracking-tight">Schauen Sie in Ihr Postfach</h1>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
          Gibt es zu dieser Adresse Anmeldungen, die noch nicht vorbei sind, haben wir Ihnen die neuen Links geschickt. Das kann
          ein, zwei Minuten dauern. Schauen Sie auch im Spam-Ordner nach.
        </p>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
          Die bisherigen Links funktionieren dann nicht mehr. Kommt nach einer Viertelstunde nichts an, melden Sie sich bitte
          beim Technikteam.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4 hover:text-foreground">
          Zur Startseite
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={senden} className="space-y-5" aria-busy={laeuft} noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Link verloren?</h1>
        <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
          Geben Sie die E-Mail-Adresse ein, mit der Sie die Veranstaltung angemeldet haben. Wir schicken Ihnen neue private Links
          zu allen Ihren Anmeldungen, die noch nicht vorbei sind.
        </p>
      </div>

      {/* Falle für Programme: Menschen sehen das Feld nicht und lassen es leer. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Bitte leer lassen
          <input ref={falle} type="text" name="webseite" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <TextField
        id="email"
        label="E-Mail-Adresse"
        type="email"
        required
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fehler ?? undefined}
      />
      <Button type="submit" className="h-12 w-full text-[15px]" disabled={laeuft || email.trim() === ""}>
        {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {laeuft ? "Wird gesendet" : "Neue Links senden"}
      </Button>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Die bisherigen Links werden damit ungültig.
      </p>
    </form>
  );
}
