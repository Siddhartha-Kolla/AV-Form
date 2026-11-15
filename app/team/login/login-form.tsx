"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/fields";
import { loginAktion, type LoginZustand } from "./actions";

export function LoginForm() {
  const [zustand, aktion, laeuft] = useActionState<LoginZustand, FormData>(loginAktion, {});

  return (
    <form action={aktion} className="space-y-5" aria-busy={laeuft}>
      <TextField
        id="benutzername"
        label="Benutzername"
        required
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
      />
      <TextField
        id="passwort"
        label="Passwort"
        required
        type="password"
        autoComplete="current-password"
        error={zustand.fehler}
      />
      <Button type="submit" className="h-12 w-full text-[15px]" disabled={laeuft}>
        {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {laeuft ? "Wird geprüft" : "Anmelden"}
      </Button>
    </form>
  );
}
