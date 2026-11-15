// Verwaltung des Teams über die Kommandozeile auf dem Server. Aufruf: npm run team -- <Befehl>
//
//   superuser <benutzername> "<Anzeigename>"   legt den einen Superuser an (nur wenn es noch keinen gibt)
//   passwort-reset <benutzername>              setzt das Passwort zurück, auch das des Superusers
//   liste                                      zeigt alle Konten
//
// Das erzeugte Startpasswort erscheint nur hier und muss beim ersten Login geändert werden.
import { dbSchliessen } from "../lib/server/db.ts";
import { FachFehler } from "../lib/server/auth/fehler.ts";
import { listeKonten } from "../lib/server/auth/konten.ts";
import { legeSuperuserAn, setzePasswortPerKommandozeile } from "../lib/server/auth/verwaltung.ts";

const kontext = { ip: null, geraet: "Kommandozeile" };
const [befehl, ...argumente] = process.argv.slice(2);

function hilfe(): never {
  console.error(
    [
      "Befehle:",
      '  npm run team -- superuser <benutzername> "<Anzeigename>"',
      "  npm run team -- passwort-reset <benutzername>",
      "  npm run team -- liste",
    ].join("\n"),
  );
  process.exit(1);
}

try {
  if (befehl === "superuser") {
    const [benutzername, anzeigename] = argumente;
    if (!benutzername || !anzeigename) hilfe();
    const { konto, startpasswort } = await legeSuperuserAn({ benutzername, anzeigename }, kontext);
    console.log(`Superuser angelegt: ${konto.benutzername} (${konto.anzeigename})`);
    console.log(`Startpasswort: ${startpasswort}`);
    console.log("Das Passwort wird nur jetzt angezeigt. Beim ersten Login muss ein eigenes gewählt werden.");
  } else if (befehl === "passwort-reset") {
    const [benutzername] = argumente;
    if (!benutzername) hilfe();
    const { konto, startpasswort } = await setzePasswortPerKommandozeile(benutzername, kontext);
    console.log(`Neues Startpasswort für ${konto.benutzername}: ${startpasswort}`);
    console.log("Alle Sitzungen dieses Kontos sind beendet. Beim nächsten Login muss ein eigenes Passwort gewählt werden.");
  } else if (befehl === "liste") {
    for (const k of listeKonten()) {
      console.log(`${k.benutzername.padEnd(20)} ${k.rolle.padEnd(10)} ${k.status.padEnd(9)} ${k.anzeigename}`);
    }
  } else {
    hilfe();
  }
} catch (fehler) {
  console.error(fehler instanceof FachFehler ? fehler.message : fehler);
  process.exitCode = 1;
} finally {
  dbSchliessen();
}
