// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "technik-team-test-"));
process.env.DATA_DIR = dir;
process.env.APP_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;

const { dbSchliessen } = await import("../lib/server/db.ts");
const { emptyValues } = await import("../lib/registration.ts");
const anm = await import("../lib/server/anmeldungen.ts");
const dat = await import("../lib/server/dateien.ts");
const team = await import("../lib/server/team-anmeldungen.ts");
const prot = await import("../lib/server/auth/protokoll.ts");
const verw = await import("../lib/server/auth/verwaltung.ts");
const konten = await import("../lib/server/auth/konten.ts");
const { FachFehler } = await import("../lib/server/auth/fehler.ts");

const kontext = { ip: "203.0.113.7", geraet: "Test" };

after(() => {
  dbSchliessen();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function team_() {
  const { konto: chef } = await verw.legeSuperuserAn({ benutzername: "chef", anzeigename: "Chef" }, kontext);
  const { konto: mitglied } = await verw.legeMitgliedAn(
    chef,
    { benutzername: "mitglied", anzeigename: "Mitglied", rolle: "mitglied" },
    kontext,
  );
  return { chef, mitglied };
}

const { chef, mitglied } = await team_();

function neueAnmeldung() {
  return anm.erstelleAnmeldung({ ...emptyValues(), titel: "Sommerkonzert", lehrkraft: "Frau Test", email: "t@schule.example", datum: "2099-06-17", beginn: "18:00", ende: "20:00", ort: "Aula", arten: ["konzert"] });
}

describe("Zugriff des Teams", () => {
  it("liefert Anmeldungen nur mit Berechtigung", () => {
    neueAnmeldung();
    assert.ok(team.alleFuerTeam(mitglied).anmeldungen.length >= 1);
    const ohne = { ...mitglied, rolle: "gibtsnicht" } as unknown as typeof mitglied;
    assert.throws(() => team.alleFuerTeam(ohne), FachFehler);
    assert.throws(() => team.alleFuerTeam({ ...mitglied, status: "gesperrt" }), FachFehler);
  });

  it("protokolliert das Ansehen höchstens einmal in 30 Minuten", () => {
    const { id } = neueAnmeldung();
    const vorher = prot.listeProtokoll({ ereignisse: ["anmeldung.angesehen"], limit: 200 }).zeilen.length;
    assert.ok(team.oeffneFuerTeam(mitglied, id, kontext));
    assert.ok(team.oeffneFuerTeam(mitglied, id, kontext));
    const nachher = prot.listeProtokoll({ ereignisse: ["anmeldung.angesehen"], limit: 200 }).zeilen;
    assert.equal(nachher.length, vorher + 1);
    assert.equal(nachher[0].zielName, "Sommerkonzert");
    assert.equal(team.oeffneFuerTeam(mitglied, "../x", kontext), null);
    assert.equal(team.oeffneFuerTeam(mitglied, "0".repeat(32), kontext), null);
  });

  it("gibt Dateien nur über die richtige Anmeldung heraus und protokolliert den Download", () => {
    const a = neueAnmeldung();
    const b = neueAnmeldung();
    const info = dat.speichereDatei(a.id, "Plan.pdf", Buffer.from("Inhalt"));
    const datei = team.ladeDateiFuerTeam(mitglied, a.id, info.id, kontext);
    assert.equal(datei?.info.name, "Plan.pdf");
    assert.equal(team.ladeDateiFuerTeam(mitglied, b.id, info.id, kontext), null);
    const eintrag = prot.listeProtokoll({ ereignisse: ["datei.heruntergeladen"] }).zeilen[0];
    assert.equal(eintrag.zielName, "Plan.pdf");
    assert.equal(eintrag.details.anmeldung, "Sommerkonzert");
  });

  it("zählt die Vorschau getrennt vom Download und nur einmal in 30 Minuten", () => {
    const a = neueAnmeldung();
    const info = dat.speichereDatei(a.id, "Vorschau.pdf", Buffer.from("Inhalt"));
    const vorher = prot.listeProtokoll({ ereignisse: ["datei.angesehen"], limit: 200 }).zeilen.length;
    assert.ok(team.ladeDateiFuerTeam(mitglied, a.id, info.id, kontext, "vorschau"));
    assert.ok(team.ladeDateiFuerTeam(mitglied, a.id, info.id, kontext, "vorschau"));
    assert.equal(prot.listeProtokoll({ ereignisse: ["datei.angesehen"], limit: 200 }).zeilen.length, vorher + 1);
    const downloads = prot.listeProtokoll({ ereignisse: ["datei.heruntergeladen"], limit: 200 }).zeilen.length;
    team.ladeDateiFuerTeam(mitglied, a.id, info.id, kontext);
    team.ladeDateiFuerTeam(mitglied, a.id, info.id, kontext);
    assert.equal(prot.listeProtokoll({ ereignisse: ["datei.heruntergeladen"], limit: 200 }).zeilen.length, downloads + 2);
  });

  it("lässt nur den Superuser löschen und protokolliert es mit dem Titel", () => {
    const a = neueAnmeldung();
    const info = dat.speichereDatei(a.id, "Weg.pdf", Buffer.from("x"));
    const pfad = path.join(dir, "dateien", `${info.id}.bin`);
    assert.ok(fs.existsSync(pfad));

    assert.throws(() => team.loescheAnmeldungFuerTeam(mitglied, a.id, kontext), /Berechtigung/);
    assert.ok(anm.findeNachId(a.id));

    team.loescheAnmeldungFuerTeam(chef, a.id, kontext);
    assert.equal(anm.findeNachId(a.id), null);
    assert.ok(!fs.existsSync(pfad));
    const eintrag = prot.listeProtokoll({ ereignisse: ["anmeldung.geloescht"] }).zeilen[0];
    assert.equal(eintrag.zielName, "Sommerkonzert");
    assert.equal(eintrag.akteurName, "Chef");
    assert.throws(() => team.loescheAnmeldungFuerTeam(chef, a.id, kontext), /nicht mehr/);
    assert.ok(konten.findeKonto(chef.id));
  });
});
