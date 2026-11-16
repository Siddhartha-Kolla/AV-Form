"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/dialog";
import { SelectField, TextField } from "@/components/fields";
import { Startpasswort } from "@/components/startpasswort";
import { cn } from "@/lib/utils";
import { ROLLEN, type RolleId } from "@/lib/berechtigungen";
import {
  aendernAktion,
  anlegenAktion,
  loeschenAktion as loeschenServerAktion,
  sitzungenBeendenAktion,
  statusAktion,
  zuruecksetzenAktion,
  type Zustand,
} from "./actions";

export type MitgliedAnsicht = {
  id: string;
  benutzername: string;
  anzeigename: string;
  email: string;
  rolle: string;
  gesperrt: boolean;
  mussPasswortAendern: boolean;
  sitzungen: number;
  /** Fertig formatiert, zum Beispiel "12.11.2026, 09:15". Leer, wenn es noch keine Anmeldung gab. */
  letzteAnmeldung: string | null;
};

/* Bausteine -------------------------------------------------------------- */

function Absenden({ laeuft, children, variante = "default", className }: { laeuft: boolean; children: ReactNode; variante?: "default" | "outline" | "destructive"; className?: string }) {
  return (
    <Button
      type="submit"
      variant={variante}
      disabled={laeuft}
      className={cn(
        "h-10 px-4 text-[15px]",
        variante === "outline" && "border-input bg-surface shadow-none",
        variante === "destructive" && "border border-destructive/40 bg-surface text-destructive hover:bg-destructive/10",
        className,
      )}
    >
      {laeuft && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </Button>
  );
}

function Rueckmeldung({ zustand }: { zustand: Zustand }) {
  if (zustand.fehler) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {zustand.fehler}
      </p>
    );
  }
  if (zustand.meldung) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {zustand.meldung}
      </p>
    );
  }
  return null;
}

/** Entweder ein erzeugtes Startpasswort oder ein selbst gewähltes. */
function PasswortWahl({ idPrefix }: { idPrefix: string }) {
  const [eigenes, setEigenes] = useState(false);
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-sm font-medium">Startpasswort</legend>
      <label className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
        <input type="radio" name="modus" value="erzeugen" checked={!eigenes} onChange={() => setEigenes(false)} className="size-4 accent-primary" />
        Automatisch erzeugen
      </label>
      <label className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
        <input type="radio" name="modus" value="eigenes" checked={eigenes} onChange={() => setEigenes(true)} className="size-4 accent-primary" />
        Selbst festlegen
      </label>
      {eigenes && (
        <TextField
          id={`${idPrefix}-passwort`}
          label="Passwort, mindestens 12 Zeichen"
          autoComplete="off"
          className="pt-2"
          required
          // Das Feld heißt für die Action "passwort".
          name="passwort"
        />
      )}
    </fieldset>
  );
}

/** Rollenauswahl, die darunter sagt, was die gewählte Rolle darf. */
function RollenWahl({ id, name, defaultValue, rollen }: { id: string; name?: string; defaultValue: string; rollen: RolleId[] }) {
  const [rolle, setRolle] = useState(defaultValue);
  const beschreibung = ROLLEN[rolle as keyof typeof ROLLEN]?.beschreibung;
  return (
    <SelectField id={id} name={name} label="Rolle" value={rolle} onChange={(e) => setRolle(e.target.value)} hint={beschreibung}>
      {rollen.map((r) => (
        <option key={r} value={r}>
          {ROLLEN[r].name}
        </option>
      ))}
    </SelectField>
  );
}

/* Mitglied anlegen -------------------------------------------------------- */

export function MitgliedAnlegen({ rollen }: { rollen: RolleId[] }) {
  const [zustand, aktion, laeuft] = useActionState<Zustand, FormData>(anlegenAktion, {});
  const [version, setVersion] = useState(0);

  return (
    <Dialog titel="Mitglied anlegen" beschreibung="Das Mitglied bekommt ein Startpasswort und wählt beim ersten Login ein eigenes." knopf="Mitglied anlegen" knopfVariante="default" knopfClassName="h-10 px-4 text-[15px]">
      {zustand.ok && (zustand.startpasswort || zustand.meldung) ? (
        <div className="space-y-4">
          {zustand.startpasswort && zustand.benutzername && (
            <Startpasswort passwort={zustand.startpasswort} benutzername={zustand.benutzername} />
          )}
          <Rueckmeldung zustand={zustand} />
          <Button type="button" variant="outline" className="h-10 border-input bg-surface px-4 shadow-none" onClick={() => setVersion((v) => v + 1)}>
            Weiteres Mitglied anlegen
          </Button>
        </div>
      ) : (
        <form key={version} action={aktion} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="anzeigename" label="Name" required autoComplete="off" />
            <TextField id="benutzername" label="Benutzername" required autoComplete="off" autoCapitalize="none" spellCheck={false} hint="Kleinbuchstaben, Ziffern, Punkt, Bindestrich." />
          </div>
          <TextField id="email" label="E-Mail (optional)" type="email" autoComplete="off" />
          <RollenWahl id="rolle" rollen={rollen} defaultValue={rollen.includes("mitglied") ? "mitglied" : rollen[0]} />
          <PasswortWahl idPrefix="neu" />
          <div className="flex flex-wrap items-center gap-4">
            <Absenden laeuft={laeuft}>Anlegen</Absenden>
            <Rueckmeldung zustand={zustand} />
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* Mitglied verwalten ------------------------------------------------------- */

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h3 className="mb-4 text-[15px] font-semibold">{titel}</h3>
      {children}
    </section>
  );
}

/** Eine einzelne Handlung: links, was sie bewirkt, rechts der Knopf. Auf dem Handy untereinander. */
function Handlung({ titel, text, knopf, children }: { titel: string; text: ReactNode; knopf: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-[15px] font-medium">{titel}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{knopf}</div>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function MitgliedVerwalten({ m, rollen }: { m: MitgliedAnsicht; rollen: RolleId[] }) {
  const [daten, datenAktion, datenLaeuft] = useActionState<Zustand, FormData>(aendernAktion, {});
  const [reset, resetAktion, resetLaeuft] = useActionState<Zustand, FormData>(zuruecksetzenAktion, {});
  const [status, statusAk, statusLaeuft] = useActionState<Zustand, FormData>(statusAktion, {});
  const [sitzungen, sitzungenAktion, sitzungenLaeuft] = useActionState<Zustand, FormData>(sitzungenBeendenAktion, {});
  const [loeschen, loeschenAktion, loeschenLaeuft] = useActionState<Zustand, FormData>(loeschenServerAktion, {});
  const [sicher, setSicher] = useState(false);

  return (
    <Dialog titel={m.anzeigename} beschreibung={`@${m.benutzername} · ${m.letzteAnmeldung ? `zuletzt angemeldet ${m.letzteAnmeldung}` : "noch nie angemeldet"}`} knopf="Verwalten">
      <div className="space-y-7">
        <Abschnitt titel="Daten">
          <form action={datenAktion} className="space-y-4">
            <input type="hidden" name="id" value={m.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id={`name-${m.id}`} name="anzeigename" label="Name" required defaultValue={m.anzeigename} />
              <TextField id={`email-${m.id}`} name="email" label="E-Mail (optional)" type="email" defaultValue={m.email} />
            </div>
            <RollenWahl id={`rolle-${m.id}`} name="rolle" rollen={rollen} defaultValue={m.rolle} />
            <div className="flex flex-wrap items-center gap-4">
              <Absenden laeuft={datenLaeuft}>Speichern</Absenden>
              <Rueckmeldung zustand={daten} />
            </div>
          </form>
        </Abschnitt>

        <Abschnitt titel="Passwort zurücksetzen">
          {reset.ok && reset.startpasswort ? (
            <Startpasswort passwort={reset.startpasswort} benutzername={m.benutzername} />
          ) : (
            <form action={resetAktion} className="space-y-4">
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="benutzername" value={m.benutzername} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Alle Sitzungen enden sofort. Beim nächsten Login wählt {m.anzeigename} ein eigenes Passwort.
                {m.mussPasswortAendern && " Das jetzige Startpasswort ist noch nicht geändert worden."}
              </p>
              <PasswortWahl idPrefix={`reset-${m.id}`} />
              <div className="flex flex-wrap items-center gap-4">
                <Absenden laeuft={resetLaeuft} variante="outline">Passwort zurücksetzen</Absenden>
                <Rueckmeldung zustand={reset} />
              </div>
            </form>
          )}
        </Abschnitt>

        <Abschnitt titel="Zugang">
          <div className="space-y-5">
            <form action={statusAk}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="status" value={m.gesperrt ? "aktiv" : "gesperrt"} />
              <Handlung
                titel={m.gesperrt ? "Das Konto ist gesperrt" : "Konto sperren"}
                text={
                  m.gesperrt
                    ? `${m.anzeigename} kann sich nicht anmelden, bis du das Konto freigibst.`
                    : "Gesperrte Konten können sich nicht anmelden."
                }
                knopf={<Absenden laeuft={statusLaeuft} variante="outline">{m.gesperrt ? "Konto freigeben" : "Konto sperren"}</Absenden>}
              >
                <Rueckmeldung zustand={status} />
              </Handlung>
            </form>
            <form action={sitzungenAktion}>
              <input type="hidden" name="id" value={m.id} />
              <Handlung
                titel="Sitzungen beenden"
                text={
                  m.sitzungen === 0
                    ? "Zurzeit ist keine Sitzung angemeldet."
                    : `Zurzeit angemeldet: ${m.sitzungen} Sitzung${m.sitzungen === 1 ? "" : "en"}.`
                }
                knopf={<Absenden laeuft={sitzungenLaeuft} variante="outline">Alle beenden</Absenden>}
              >
                <Rueckmeldung zustand={sitzungen} />
              </Handlung>
            </form>
          </div>
        </Abschnitt>

        <Abschnitt titel="Löschen">
          {loeschen.ok ? (
            <Rueckmeldung zustand={loeschen} />
          ) : (
            <form action={loeschenAktion}>
              <input type="hidden" name="id" value={m.id} />
              <Handlung
                titel="Mitglied löschen"
                text="Das Konto und alle seine Sitzungen werden entfernt. Das Protokoll behält die Einträge, auch mit dem Namen."
                knopf={
                  sicher ? (
                    <>
                      <Absenden laeuft={loeschenLaeuft} variante="destructive">Ja, löschen</Absenden>
                      <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setSicher(false)}>
                        Abbrechen
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 border-destructive/40 bg-surface px-4 text-[15px] text-destructive shadow-none hover:bg-destructive/10"
                      onClick={() => setSicher(true)}
                    >
                      Mitglied löschen
                    </Button>
                  )
                }
              >
                <Rueckmeldung zustand={loeschen} />
              </Handlung>
            </form>
          )}
        </Abschnitt>
      </div>
    </Dialog>
  );
}
