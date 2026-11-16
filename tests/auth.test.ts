// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "technik-auth-test-"));
process.env.DATA_DIR = dir;
process.env.APP_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
process.env.AUTH_ANBIETER = "passwort,test-oidc";

const { db, dbSchliessen } = await import("../lib/server/db.ts");
const pw = await import("../lib/server/auth/passwort.ts");
const konten = await import("../lib/server/auth/konten.ts");
const sitz = await import("../lib/server/auth/sitzungen.ts");
const { anmelden, anmeldenMitIdentitaet } = await import("../lib/server/auth/anmelden.ts");
const verw = await import("../lib/server/auth/verwaltung.ts");
const prot = await import("../lib/server/auth/protokoll.ts");
const { registriereAnbieter, holeAnbieter } = await import("../lib/server/auth/anbieter.ts");
const { FachFehler } = await import("../lib/server/auth/fehler.ts");
const { darf, BERECHTIGUNGEN, vergebbareRollen } = await import("../lib/berechtigungen.ts");

const kontext = { ip: "203.0.113.7", geraet: "Testbrowser" };
const SUPER_PW = "ein-sehr-langes-passwort-1";
const PW = "zufaellig-langes-passwort-42";
const PW2 = "zweites-langes-passwort-43";

after(() => {
  dbSchliessen();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function neuerSuperuser() {
  const { konto, startpasswort } = await verw.legeSuperuserAn(
    { benutzername: "chef", anzeigename: "Chef Superuser", email: "chef.geheim@schule.example" },
    kontext,
  );
  await konten.setzePasswort(konto.id, SUPER_PW, false);
  return { konto, startpasswort };
}

describe("Passwörter", () => {
  it("hasht und prüft", async () => {
    const hash = await pw.passwortHashen("ein-langes-passwort-123");
    assert.ok(hash.startsWith("scrypt$"));
    assert.ok(await pw.passwortPruefen("ein-langes-passwort-123", hash));
    assert.ok(!(await pw.passwortPruefen("falsch", hash)));
    assert.notEqual(hash, await pw.passwortHashen("ein-langes-passwort-123"));
  });

  it("erzwingt die Regeln", () => {
    assert.match(pw.passwortProblem("kurz", "max")!, /mindestens/);
    assert.match(pw.passwortProblem("maximilian-ist-toll", "maximilian")!, /Benutzernamen/);
    assert.match(pw.passwortProblem("aaaaaaaaaaaaaaaa", "x")!, /einfach/);
    assert.equal(pw.passwortProblem("ein-gutes-passwort-77", "max"), null);
  });

  it("erzeugt lesbare Startpasswörter", () => {
    const a = pw.neuesStartpasswort();
    assert.match(a, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    assert.equal(pw.passwortProblem(a, "max"), null);
    assert.notEqual(a, pw.neuesStartpasswort());
  });
});

describe("Superuser und Mitglieder", () => {
  it("legt genau einen Superuser an", async () => {
    const { konto, startpasswort } = await neuerSuperuser();
    assert.equal(konto.rolle, "superuser");
    assert.ok(startpasswort.length > 10);
    await assert.rejects(
      verw.legeSuperuserAn({ benutzername: "zweiter", anzeigename: "Zweiter" }, kontext),
      FachFehler,
    );
    // Auch direkt in der Datenbank ist ein zweiter Superuser unmöglich.
    assert.throws(() =>
      db()
        .prepare(
          "INSERT INTO konten (id, benutzername_hash, daten, rolle, erstellt_am, geaendert_am) VALUES ('x','h',x'00','superuser','a','b')",
        )
        .run(),
    );
  });

  it("lässt nur den Superuser Mitglieder verwalten", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { konto: max, startpasswort } = await verw.legeMitgliedAn(
      chef,
      { benutzername: "Max.Muster", anzeigename: "Max Muster", email: "max@schule.example", rolle: "mitglied" },
      kontext,
    );
    assert.equal(max.benutzername, "max.muster");
    assert.ok(startpasswort);
    assert.ok(max.mussPasswortAendern);
    await assert.rejects(
      verw.legeMitgliedAn(max, { benutzername: "anna", anzeigename: "Anna", rolle: "mitglied" }, kontext),
      /Berechtigung/,
    );
    await assert.rejects(
      verw.legeMitgliedAn(chef, { benutzername: "max.muster", anzeigename: "Doppelt", rolle: "mitglied" }, kontext),
      /vergeben/,
    );
    await assert.rejects(
      verw.legeMitgliedAn(chef, { benutzername: "root2", anzeigename: "Root", rolle: "superuser" }, kontext),
      /Rolle/,
    );
    await assert.rejects(
      verw.legeMitgliedAn(chef, { benutzername: "a b", anzeigename: "Leerzeichen", rolle: "mitglied" }, kontext),
      /Benutzername/,
    );
    assert.ok(darf("mitglied", "anmeldungen.lesen"));
    assert.ok(!darf("mitglied", "team.verwalten"));
  });

  it("schützt den Superuser vor Änderungen über die Oberfläche", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    assert.throws(() => verw.setzeMitgliedStatus(chef, chef.id, "gesperrt", kontext), /Superuser/);
    assert.throws(() => verw.loescheMitglied(chef, chef.id, kontext));
    assert.throws(() => verw.aendereMitglied(chef, chef.id, { anzeigename: "X", rolle: "mitglied" }, kontext));
    await assert.rejects(verw.setzeMitgliedPasswortZurueck(chef, chef.id, undefined, kontext), /Kommandozeile/);
  });
});

describe("Anmeldung", () => {
  it("meldet mit richtigen Daten an und protokolliert", async () => {
    const ergebnis = await anmelden("passwort", { benutzername: " CHEF ", passwort: SUPER_PW }, kontext);
    assert.ok(ergebnis.ok);
    if (!ergebnis.ok) return;
    const geprueft = sitz.pruefeSitzung(ergebnis.token);
    assert.equal(geprueft?.konto.benutzername, "chef");
    assert.ok(konten.findeKonto(ergebnis.konto.id)?.letzterLogin);
    const zeilen = prot.listeProtokoll({ ereignisse: ["login.erfolg"] }).zeilen;
    assert.equal(zeilen[0].akteurName, "Chef Superuser");
    assert.equal(zeilen[0].ip, "203.0.113.7");
  });

  it("antwortet bei falschem Passwort und unbekanntem Benutzer gleich", async () => {
    const a = await anmelden("passwort", { benutzername: "chef", passwort: "falsch-falsch-1" }, kontext);
    const b = await anmelden("passwort", { benutzername: "gibtsnicht", passwort: "falsch-falsch-1" }, kontext);
    assert.deepEqual(a, { ok: false, grund: "ungueltig" });
    assert.deepEqual(b, { ok: false, grund: "ungueltig" });
    assert.deepEqual(await anmelden("gibtsnicht", {}, kontext), { ok: false, grund: "ungueltig" });
  });

  it("bremst nach zu vielen Fehlversuchen, auch bei richtigem Passwort", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { konto: anna } = await verw.legeMitgliedAn(
      chef,
      { benutzername: "anna", anzeigename: "Anna", rolle: "mitglied", passwort: PW },
      kontext,
    );
    const andereIp = { ip: "198.51.100.9", geraet: "x" };
    for (let i = 0; i < 5; i++) {
      assert.equal((await anmelden("passwort", { benutzername: "anna", passwort: "nein-nein-nein-1" }, andereIp)).ok, false);
    }
    const gedrosselt = await anmelden("passwort", { benutzername: "anna", passwort: PW }, andereIp);
    assert.deepEqual(gedrosselt, { ok: false, grund: "gedrosselt" });
    assert.ok(prot.listeProtokoll({ ereignisse: ["login.gedrosselt"] }).zeilen.length >= 1);
    assert.ok(konten.findeKonto(anna.id));
  });

  it("verweigert gesperrten Konten die Anmeldung und beendet ihre Sitzungen", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { konto } = await verw.legeMitgliedAn(
      chef,
      { benutzername: "bob", anzeigename: "Bob", rolle: "mitglied", passwort: PW },
      kontext,
    );
    const ok = await anmelden("passwort", { benutzername: "bob", passwort: PW }, { ip: null, geraet: null });
    assert.ok(ok.ok);
    if (!ok.ok) return;
    verw.setzeMitgliedStatus(chef, konto.id, "gesperrt", kontext);
    assert.equal(sitz.pruefeSitzung(ok.token), null);
    const nein = await anmelden("passwort", { benutzername: "bob", passwort: PW }, { ip: null, geraet: null });
    assert.deepEqual(nein, { ok: false, grund: "gesperrt" });
    verw.setzeMitgliedStatus(chef, konto.id, "aktiv", kontext);
    assert.ok((await anmelden("passwort", { benutzername: "bob", passwort: PW }, { ip: null, geraet: null })).ok);
  });
});

describe("Sitzungen", () => {
  it("laufen nach Leerlauf und nach der Höchstdauer ab", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const jetzt = new Date();
    const { token } = sitz.erstelleSitzung(chef.id, "passwort", kontext, jetzt);
    assert.equal(sitz.pruefeSitzung(token, new Date(jetzt.getTime() + 9 * 3_600_000)), null);
    const { token: t1 } = sitz.erstelleSitzung(chef.id, "passwort", kontext, jetzt);
    assert.ok(sitz.pruefeSitzung(t1, new Date(jetzt.getTime() + 7 * 3_600_000)));
    assert.ok(sitz.pruefeSitzung(t1, new Date(jetzt.getTime() + 14 * 3_600_000)), "Aktivität verlängert den Leerlauf");

    const { token: t2 } = sitz.erstelleSitzung(chef.id, "passwort", kontext, jetzt);
    for (let h = 6; h < 24 * 8; h += 6) sitz.pruefeSitzung(t2, new Date(jetzt.getTime() + h * 3_600_000));
    assert.equal(sitz.pruefeSitzung(t2, new Date(jetzt.getTime() + 8 * 86_400_000)), null);
  });

  it("speichert nur den Hash des Tokens", () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { token } = sitz.erstelleSitzung(chef.id, "passwort", kontext);
    db().pragma("wal_checkpoint(TRUNCATE)");
    const roh = fs.readFileSync(path.join(dir, "technik.db")).toString("latin1");
    assert.ok(!roh.includes(token));
    assert.equal(sitz.pruefeSitzung("x".repeat(43)), null);
    assert.equal(sitz.pruefeSitzung("kurz"), null);
  });
});

describe("Passwort zurücksetzen und ändern", () => {
  it("setzt zurück, erzwingt einen Wechsel und beendet Sitzungen", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { konto } = await verw.legeMitgliedAn(
      chef,
      { benutzername: "clara", anzeigename: "Clara", rolle: "mitglied", passwort: PW },
      kontext,
    );
    const eingeloggt = await anmelden("passwort", { benutzername: "clara", passwort: PW }, { ip: null, geraet: null });
    assert.ok(eingeloggt.ok);
    if (!eingeloggt.ok) return;

    const { startpasswort } = await verw.setzeMitgliedPasswortZurueck(chef, konto.id, undefined, kontext);
    assert.ok(startpasswort);
    assert.equal(sitz.pruefeSitzung(eingeloggt.token), null);
    assert.ok(konten.findeKonto(konto.id)?.mussPasswortAendern);
    const alt = await anmelden("passwort", { benutzername: "clara", passwort: PW }, { ip: null, geraet: null });
    assert.equal(alt.ok, false);
    const neu = await anmelden("passwort", { benutzername: "clara", passwort: startpasswort! }, { ip: null, geraet: null });
    assert.ok(neu.ok);
    if (!neu.ok) return;

    const sitzungId = sitz.pruefeSitzung(neu.token)!.sitzung.id;
    const andere = sitz.erstelleSitzung(konto.id, "passwort", kontext);
    await assert.rejects(
      verw.aendereEigenesPasswort(konten.findeKonto(konto.id)!, sitzungId, { aktuell: "falsch-falsch-123", neu: PW2 }, kontext),
      /stimmt nicht/,
    );
    await verw.aendereEigenesPasswort(
      konten.findeKonto(konto.id)!,
      sitzungId,
      { aktuell: startpasswort!, neu: PW2 },
      kontext,
    );
    assert.ok(!konten.findeKonto(konto.id)!.mussPasswortAendern);
    assert.equal(sitz.pruefeSitzung(andere.token), null);
    assert.ok(sitz.pruefeSitzung(neu.token));
    assert.ok((await anmelden("passwort", { benutzername: "clara", passwort: PW2 }, { ip: null, geraet: null })).ok);
  });

  it("setzt das Passwort des Superusers per Kommandozeile zurück", async () => {
    const { startpasswort } = await verw.setzePasswortPerKommandozeile("chef", kontext);
    assert.ok((await anmelden("passwort", { benutzername: "chef", passwort: startpasswort }, { ip: null, geraet: null })).ok);
    assert.ok(prot.listeProtokoll({ ereignisse: ["cli.passwort_zurueckgesetzt"] }).zeilen.length === 1);
  });
});

describe("Weitere Anmeldeanbieter", () => {
  it("nehmen am selben Ablauf teil, ohne dass sich Konten oder Sitzungen ändern", () => {
    registriereAnbieter({
      id: "test-oidc",
      anzeige: "Schul-Login",
      art: "weiterleitung",
      beginnen: async () => ({ url: "https://idp.example/auth" }),
      abschliessen: async () => ({ subjekt: "sub-123" }),
    });
    const chef = konten.findeKontoNachBenutzername("chef")!;
    assert.equal(holeAnbieter("test-oidc")?.art, "weiterleitung");
    assert.equal(holeAnbieter("nicht-aktiviert"), null);

    const vorher = anmeldenMitIdentitaet("test-oidc", "sub-123", kontext);
    assert.deepEqual(vorher, { ok: false, grund: "ungueltig" });
    assert.ok(prot.listeProtokoll({ ereignisse: ["login.kein_konto"] }).zeilen.length >= 1);

    konten.verknuepfeIdentitaet(chef.id, "test-oidc", "sub-123");
    const nachher = anmeldenMitIdentitaet("test-oidc", "sub-123", kontext);
    assert.ok(nachher.ok);
    assert.equal(nachher.ok && nachher.konto.id, chef.id);
    assert.deepEqual(konten.identitaetenVon(chef.id).sort(), ["passwort", "test-oidc"]);
  });
});

describe("Protokoll und Datenschutz", () => {
  it("filtert, behält Namen gelöschter Konten und speichert keine Geheimnisse", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { konto } = await verw.legeMitgliedAn(
      chef,
      { benutzername: "dora", anzeigename: "Dora Temporär", rolle: "mitglied", passwort: PW },
      kontext,
    );
    verw.loescheMitglied(chef, konto.id, kontext);
    assert.equal(konten.findeKonto(konto.id), null);

    const geloescht = prot.listeProtokoll({ ereignisse: ["konto.geloescht"] }).zeilen[0];
    assert.equal(geloescht.zielName, "Dora Temporär");
    assert.equal(geloescht.akteurName, "Chef Superuser");

    prot.protokolliere(
      { ereignis: "login.erfolg", details: { passwort: "geheim", token: "geheim", anbieter: "passwort" } },
      kontext,
    );
    const neueste = prot.listeProtokoll({ limit: 1 }).zeilen[0];
    assert.deepEqual(neueste.details, { anbieter: "passwort" });

    const nurChef = prot.listeProtokoll({ akteurId: chef.id, limit: 200 }).zeilen;
    assert.ok(nurChef.every((z) => z.akteurId === chef.id));
    const seite1 = prot.listeProtokoll({ limit: 3 });
    assert.ok(seite1.hatMehr);
    const seite2 = prot.listeProtokoll({ limit: 3, vorId: seite1.zeilen[2].id });
    assert.ok(seite2.zeilen[0].id < seite1.zeilen[2].id);
  });

  it("legt Namen, E-Mail-Adressen und IPs nicht im Klartext ab", () => {
    db().pragma("wal_checkpoint(TRUNCATE)");
    const roh = fs.readFileSync(path.join(dir, "technik.db")).toString("latin1");
    for (const geheim of ["Chef Superuser", "chef.geheim@schule.example", "max.muster", "Max Muster", "203.0.113.7", "Testbrowser"]) {
      assert.ok(!roh.includes(geheim), `${geheim} steht im Klartext in der Datenbank`);
    }
  });

  it("löscht altes Protokoll nach der Aufbewahrungsfrist", () => {
    const vorher = prot.listeProtokoll({ limit: 200 }).zeilen.length;
    assert.ok(vorher > 0);
    const geloescht = prot.loescheAltesProtokoll(new Date(Date.now() + 400 * 86_400_000));
    assert.equal(geloescht, vorher);
    assert.equal(prot.listeProtokoll({}).zeilen.length, 0);
  });
});

describe("Admin", () => {
  it("hat alle Berechtigungen außer dem Protokoll", () => {
    for (const b of BERECHTIGUNGEN) assert.equal(darf("admin", b), b !== "protokoll.lesen", b);
    assert.deepEqual(vergebbareRollen("superuser"), ["admin", "mitglied"]);
    assert.deepEqual(vergebbareRollen("admin"), ["mitglied"]);
    assert.deepEqual(vergebbareRollen("mitglied"), []);
  });

  it("wird nur vom Superuser angelegt und verwaltet Mitglieder, aber keine Admins", async () => {
    const chef = konten.findeKontoNachBenutzername("chef")!;
    const { konto: ada } = await verw.legeMitgliedAn(chef, { benutzername: "ada.admin", anzeigename: "Ada Admin", rolle: "admin" }, kontext);
    const { konto: bob } = await verw.legeMitgliedAn(chef, { benutzername: "bob.admin", anzeigename: "Bob Admin", rolle: "admin" }, kontext);
    assert.equal(ada.rolle, "admin");

    // Der Admin legt Mitglieder an und verwaltet sie, aber legt keine Admins an.
    const { konto: nele } = await verw.legeMitgliedAn(ada, { benutzername: "nele", anzeigename: "Nele", rolle: "mitglied" }, kontext);
    await assert.rejects(verw.legeMitgliedAn(ada, { benutzername: "cem.admin", anzeigename: "Cem", rolle: "admin" }, kontext), /Rolle/);
    verw.aendereMitglied(ada, nele.id, { anzeigename: "Nele Neu", rolle: "mitglied" }, kontext);
    assert.equal(konten.findeKonto(nele.id)!.anzeigename, "Nele Neu");
    assert.equal(verw.setzeMitgliedStatus(ada, nele.id, "gesperrt", kontext).status, "gesperrt");
    verw.setzeMitgliedStatus(ada, nele.id, "aktiv", kontext);
    assert.ok((await verw.setzeMitgliedPasswortZurueck(ada, nele.id, undefined, kontext)).startpasswort);
    verw.beendeMitgliedSitzungen(ada, nele.id, kontext);
    // Ein Admin kann ein Mitglied nicht zum Admin machen.
    assert.throws(() => verw.aendereMitglied(ada, nele.id, { anzeigename: "Nele Neu", rolle: "admin" }, kontext), /Rolle/);

    // Admins und der Superuser sind für den Admin tabu, auch das eigene Konto.
    for (const ziel of [bob, ada, chef]) {
      assert.throws(() => verw.setzeMitgliedStatus(ada, ziel.id, "gesperrt", kontext), FachFehler);
      assert.throws(() => verw.aendereMitglied(ada, ziel.id, { anzeigename: "X", rolle: "mitglied" }, kontext), FachFehler);
      assert.throws(() => verw.beendeMitgliedSitzungen(ada, ziel.id, kontext), FachFehler);
      assert.throws(() => verw.loescheMitglied(ada, ziel.id, kontext), FachFehler);
      await assert.rejects(verw.setzeMitgliedPasswortZurueck(ada, ziel.id, undefined, kontext), FachFehler);
    }
    assert.equal(konten.findeKonto(bob.id)!.rolle, "admin");

    // Der Superuser darf Admins verwalten.
    verw.aendereMitglied(chef, bob.id, { anzeigename: "Bob Admin", rolle: "mitglied" }, kontext);
    assert.equal(konten.findeKonto(bob.id)!.rolle, "mitglied");
    verw.loescheMitglied(chef, ada.id, kontext);
  });
});
