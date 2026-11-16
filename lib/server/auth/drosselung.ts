import "server-only";
import { schluesselHash } from "../crypto.ts";
import { db } from "../db.ts";

/*
  Bremst das Durchprobieren von Passwörtern. Gezählt werden Fehlversuche je Benutzername
  und je IP-Adresse in einem gleitenden Fenster. Die Schlüssel stehen nur als Hash in der Tabelle.
  Der Benutzername-Schlüssel entsteht aus der Eingabe, nicht aus dem Konto. So lässt sich
  an der Sperre nicht erkennen, ob es den Namen gibt.
*/

export const FENSTER_MINUTEN = 15;
// "einreichung_*" bremst das öffentliche Formular: je IP-Adresse und insgesamt, jeweils pro Zeitfenster.
const LIMITS = { benutzer: 5, ip: 25, einreichung_ip: 6, einreichung_alle: 40 } as const;

export type Versuchsschluessel = { art: keyof typeof LIMITS; wert: string };

function schluessel(s: Versuchsschluessel): string {
  return schluesselHash(`versuch-${s.art}`, s.wert);
}

function fensterStart(jetzt: Date): string {
  return new Date(jetzt.getTime() - FENSTER_MINUTEN * 60_000).toISOString();
}

/** Zählt einen Versuch, auch einen erfolgreichen. Gedacht für Einreichungen, die nicht scheitern müssen, um gezählt zu werden. */
export function registriereVersuch(schluesselListe: Versuchsschluessel[], jetzt: Date = new Date()): void {
  registriereFehlversuch(schluesselListe, jetzt);
}

export function istGedrosselt(schluesselListe: Versuchsschluessel[], jetzt: Date = new Date()): boolean {
  const start = fensterStart(jetzt);
  return schluesselListe.some((s) => {
    const n = (
      db()
        .prepare("SELECT COUNT(*) AS n FROM login_versuche WHERE schluessel = ? AND zeit >= ?")
        .get(schluessel(s), start) as { n: number }
    ).n;
    return n >= LIMITS[s.art];
  });
}

export function registriereFehlversuch(schluesselListe: Versuchsschluessel[], jetzt: Date = new Date()): void {
  const einfuegen = db().prepare("INSERT INTO login_versuche (zeit, schluessel) VALUES (?, ?)");
  for (const s of schluesselListe) einfuegen.run(jetzt.toISOString(), schluessel(s));
}

export function vergesseVersuche(s: Versuchsschluessel): void {
  db().prepare("DELETE FROM login_versuche WHERE schluessel = ?").run(schluessel(s));
}

export function loescheAlteVersuche(jetzt: Date = new Date()): number {
  return db().prepare("DELETE FROM login_versuche WHERE zeit < ?").run(fensterStart(jetzt)).changes;
}
