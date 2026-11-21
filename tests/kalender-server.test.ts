// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "technik-kalender-test-"));
process.env.DATA_DIR = dir;
process.env.APP_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
process.env.APP_URL = "https://technik.example";

const { dbSchliessen, db: dbRoh } = await import("../lib/server/db.ts");
const { emptyValues } = await import("../lib/registration.ts");
const anm = await import("../lib/server/anmeldungen.ts");
const verw = await import("../lib/server/auth/verwaltung.ts");
const konten = await import("../lib/server/auth/konten.ts");
const prot = await import("../lib/server/auth/protokoll.ts");
const ein = await import("../lib/server/einsaetze.ts");
const kal = await import("../lib/server/kalender.ts");

const kontext = { ip: "203.0.113.7", geraet: "Test" };

after(() => {
  dbSchliessen();
  fs.rmSync(dir, { recursive: true, force: true });
});

const { konto: chef } = await verw.legeSuperuserAn({ benutzername: "chef", anzeigename: "Chef" }, kontext);
const { konto: mitglied } = await verw.legeMitgliedAn(chef, { benutzername: "mitglied", anzeigename: "Mitglied", rolle: "mitglied" }, kontext);
const meinKonto = () => konten.findeKonto(mitglied.id)!;
const chefKonto = () => konten.findeKonto(chef.id)!;

let zaehler = 0;
function neueAnmeldung(titel: string) {
  zaehler += 1;
  return anm.erstelleAnmeldung({
    ...emptyValues(),
    titel,
    lehrkraft: "Frau Geheim",
    email: `geheim${zaehler}@schule.example`,
    datum: "2099-05-01",
    beginn: "10:00",
    ende: "12:00",
    ort: "Aula",
    arten: ["konzert"],
  });
}

function entscheide(id: string, status: "angenommen" | "rueckfrage" | "abgelehnt", erwartet: "neu" | "angenommen" | "rueckfrage" = "neu") {
  anm.entscheideAnmeldung(id, { status, nachricht: "", erwarteterStatus: erwartet, akteur: { id: chef.id, name: "Chef" } });
}

function feed(token: string, inhalt: "alle" | "meine" = "alle"): string {
  const r = kal.kalenderFuerToken(token, inhalt);
  assert.equal(r.ergebnis, "ok");
  // Entfaltet, damit sich nach Text suchen lässt.
  return r.ergebnis === "ok" ? r.ics.replaceAll("\r\n ", "") : "";
}

describe("Kalender-Link", () => {
  it("gibt es erst nach dem Erzeugen, und das Token steht nie im Klartext in der Datenbank", () => {
    assert.equal(kal.ladeKalenderLink(meinKonto()), null);
    assert.equal(kal.kalenderFuerToken("x".repeat(43), "alle").ergebnis, "unbekannt");

    const token = kal.erzeugeKalenderLink(meinKonto(), kontext);
    assert.equal(kal.ladeKalenderLink(meinKonto())?.token, token);
    const roh = dbRoh().prepare("SELECT token_hash, token_verschl FROM kalender_links").get() as { token_hash: string; token_verschl: Buffer };
    assert.notEqual(roh.token_hash, token);
    assert.ok(!roh.token_verschl.includes(Buffer.from(token)));
    assert.ok(prot.listeProtokoll({ ereignisse: ["kalender.link_erzeugt"] }).zeilen.length >= 1);
  });

  it("wird durch einen neuen Link ungültig und durch Löschen entfernt", () => {
    const alt = kal.ladeKalenderLink(meinKonto())!.token;
    const neu = kal.erzeugeKalenderLink(meinKonto(), kontext);
    assert.notEqual(alt, neu);
    assert.equal(kal.kalenderFuerToken(alt, "alle").ergebnis, "unbekannt");
    assert.equal(kal.kalenderFuerToken(neu, "alle").ergebnis, "ok");
    kal.loescheKalenderLink(meinKonto(), kontext);
    assert.equal(kal.kalenderFuerToken(neu, "alle").ergebnis, "unbekannt");
    assert.equal(kal.ladeKalenderLink(meinKonto()), null);
  });

  it("liefert nichts mehr, sobald das Konto gesperrt ist", () => {
    const token = kal.erzeugeKalenderLink(meinKonto(), kontext);
    assert.equal(kal.kalenderFuerToken(token, "alle").ergebnis, "ok");
    verw.setzeMitgliedStatus(chef, mitglied.id, "gesperrt", kontext);
    assert.equal(kal.kalenderFuerToken(token, "alle").ergebnis, "unbekannt");
    assert.throws(() => kal.erzeugeKalenderLink(meinKonto(), kontext), /Berechtigung/);
    verw.setzeMitgliedStatus(chef, mitglied.id, "aktiv", kontext);
    assert.equal(kal.kalenderFuerToken(token, "alle").ergebnis, "ok");
  });

  it("bremst zu häufiges Abrufen", () => {
    const token = kal.erzeugeKalenderLink(meinKonto(), kontext);
    const jetzt = new Date();
    let gedrosselt = 0;
    for (let i = 0; i < 40; i++) if (kal.kalenderFuerToken(token, "alle", jetzt).ergebnis === "gedrosselt") gedrosselt += 1;
    assert.equal(gedrosselt, 10, "nach 30 Abrufen in 15 Minuten ist Schluss");
    const spaeter = new Date(jetzt.getTime() + 16 * 60_000);
    assert.equal(kal.kalenderFuerToken(token, "alle", spaeter).ergebnis, "ok");
  });
});

describe("Kalender-Inhalt", () => {
  it("zeigt nur angenommene Veranstaltungen und verrät nichts über die Lehrkraft", () => {
    const token = kal.erzeugeKalenderLink(meinKonto(), kontext);
    const neu = neueAnmeldung("Noch offen");
    const ok = neueAnmeldung("Angenommenes Konzert");
    const frage = neueAnmeldung("Mit Rückfrage");
    const weg = neueAnmeldung("Abgelehnt");
    entscheide(ok.id, "angenommen");
    entscheide(frage.id, "rueckfrage");
    entscheide(weg.id, "abgelehnt");

    const ics = feed(token);
    assert.ok(ics.includes("SUMMARY:Angenommenes Konzert"));
    for (const nicht of ["Noch offen", "Mit Rückfrage", "Abgelehnt"]) assert.ok(!ics.includes(nicht), nicht);
    for (const geheim of ["Geheim", "schule.example"]) assert.ok(!ics.includes(geheim), geheim);
    assert.ok(ics.includes(`https://technik.example/team/anmeldungen/${ok.id}`));
    void neu;
  });

  it("behält eine angenommene Veranstaltung, die die Lehrkraft geändert hat, bis das Team anders entscheidet", () => {
    const token = kal.ladeKalenderLink(meinKonto())!.token;
    const a = neueAnmeldung("Geändertes Konzert");
    entscheide(a.id, "angenommen");
    assert.ok(feed(token).includes("Geändertes Konzert"));

    // Die Lehrkraft ändert etwas, die Anmeldung steht wieder auf "Zu prüfen".
    dbRoh().prepare("UPDATE anmeldungen SET status = 'neu' WHERE id = ?").run(a.id);
    dbRoh().prepare("INSERT INTO entscheidungen (anmeldung_id, zeit, status, akteur_id, daten) VALUES (?, ?, 'neu', NULL, x'00')").run(
      a.id,
      new Date(Date.now() + 1000).toISOString(),
    );
    assert.ok(feed(token).includes("Geändertes Konzert"), "bleibt im Kalender");

    entscheide(a.id, "rueckfrage");
    assert.ok(!feed(token).includes("Geändertes Konzert"), "nach einer Rückfrage nicht mehr");
  });

  it("zeigt im persönlichen Kalender nur Einsätze mit Dabei und erinnert am Vortag", () => {
    const token = kal.ladeKalenderLink(meinKonto())!.token;
    const meins = neueAnmeldung("Mein Einsatz");
    const fremd = neueAnmeldung("Ohne mich");
    entscheide(meins.id, "angenommen");
    entscheide(fremd.id, "angenommen");
    ein.setzeAntwort(meinKonto(), meins.id, mitglied.id, { antwort: "dabei", notiz: "bringe Kabel mit" }, kontext);
    ein.setzeAntwort(meinKonto(), fremd.id, mitglied.id, { antwort: "nicht_dabei", notiz: "" }, kontext);

    const meine = feed(token, "meine");
    assert.ok(meine.includes("SUMMARY:Mein Einsatz"));
    assert.ok(!meine.includes("Ohne mich"));
    assert.ok(meine.includes("TRIGGER:-P1D"));
    assert.ok(!meine.includes("bringe Kabel"), "Notizen verlassen die App nicht");

    const alle = feed(token, "alle");
    assert.ok(alle.includes("Mein Einsatz") && alle.includes("Ohne mich"));
    assert.ok(!alle.includes("BEGIN:VALARM"), "im Gesamtkalender gibt es ohne Pflicht keine Erinnerung");
  });

  it("erinnert im Gesamtkalender bei einer Pflicht und nennt sie im Titel", () => {
    const token = kal.ladeKalenderLink(meinKonto())!.token;
    const a = neueAnmeldung("Wichtiger Abend");
    entscheide(a.id, "angenommen");
    ein.setzePlanung(chefKonto(), a.id, { pflicht: true, benoetigt: 3 }, kontext);
    const alle = feed(token, "alle");
    assert.ok(alle.includes("SUMMARY:Pflicht: Wichtiger Abend"));
    assert.ok(alle.includes("TRIGGER:-P1D"));
  });
});

describe("Einzelner Termin", () => {
  it("gibt es nur für angenommene Veranstaltungen und nur mit Berechtigung", () => {
    const offen = neueAnmeldung("Termin offen");
    const ok = neueAnmeldung("Termin angenommen");
    entscheide(ok.id, "angenommen");
    assert.equal(kal.terminDatei(meinKonto(), offen.id), null);
    assert.equal(kal.terminDatei(meinKonto(), "../../etc"), null);
    const datei = kal.terminDatei(meinKonto(), ok.id);
    assert.ok(datei?.ics.includes("SUMMARY:Termin angenommen"));
    assert.ok(!datei?.ics.includes("BEGIN:VALARM"));
    verw.setzeMitgliedStatus(chef, mitglied.id, "gesperrt", kontext);
    assert.throws(() => kal.terminDatei(meinKonto(), ok.id), /Berechtigung/);
    verw.setzeMitgliedStatus(chef, mitglied.id, "aktiv", kontext);
  });
});
