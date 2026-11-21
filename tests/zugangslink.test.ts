// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "technik-zugang-test-"));
process.env.DATA_DIR = dir;
process.env.APP_ENCRYPTION_KEYS = `1:${randomBytes(32).toString("base64")}`;
process.env.APP_URL = "https://technik.example";

const { dbSchliessen } = await import("../lib/server/db.ts");
const { emptyValues } = await import("../lib/registration.ts");
const anm = await import("../lib/server/anmeldungen.ts");
const prot = await import("../lib/server/auth/protokoll.ts");
const zug = await import("../lib/server/zugangslink.ts");
const { mailZugangslinks } = await import("../lib/mail-vorlagen.ts");

after(() => {
  dbSchliessen();
  fs.rmSync(dir, { recursive: true, force: true });
});

let ip = 0;
const kontext = () => ({ ip: `203.0.113.${(ip += 1)}`, geraet: "Test" });
const JETZT = new Date("2026-11-21T10:00:00.000Z");

function anmeldung(email: string, titel: string, datum = "2099-05-01") {
  return anm.erstelleAnmeldung({ ...emptyValues(), titel, lehrkraft: "Frau Test", email, datum, beginn: "10:00", ende: "12:00", ort: "Aula", arten: ["konzert"] });
}

type Gesendet = { an: string; betreff: string; text: string; html?: string };
function postfach(ergebnis: "gesendet" | "fehlgeschlagen" = "gesendet") {
  const mails: Gesendet[] = [];
  const sende = async (mail: Gesendet) => {
    mails.push(mail);
    return { ergebnis, grund: ergebnis === "gesendet" ? null : "SMTP nicht erreichbar" } as const;
  };
  return { mails, sende };
}

async function anfordern(email: string, p = postfach(), jetzt = JETZT) {
  const r = await zug.fordereZugangslinksAn(email, kontext(), { jetzt, sende: p.sende });
  if (r.ok) await r.fertig;
  return { r, mails: p.mails };
}

function linksAusMail(mail: Gesendet): string[] {
  return [...mail.text.matchAll(/https:\/\/technik\.example\/anmeldung\/(\S+)/g)].map((m) => m[1]);
}

describe("Link verloren", () => {
  it("schickt neue Links per Mail und entwertet die alten erst danach", async () => {
    const a = anmeldung("verloren@schule.example", "Konzert A", "2099-05-01");
    const b = anmeldung("verloren@schule.example", "Elternabend B", "2099-03-01");
    const { r, mails } = await anfordern("  Verloren@Schule.example ");
    assert.equal(r.ok, true);
    assert.equal(mails.length, 1, "eine Mail für alle Anmeldungen");
    assert.equal(mails[0].an, "verloren@schule.example");

    const tokens = linksAusMail(mails[0]);
    assert.equal(tokens.length, 2);
    assert.ok(mails[0].text.indexOf("Elternabend B") < mails[0].text.indexOf("Konzert A"), "die nächste Veranstaltung steht zuerst");
    assert.equal(anm.findeNachToken(a.token), null, "der alte Link gilt nicht mehr");
    assert.equal(anm.findeNachToken(b.token), null);
    for (const t of tokens) assert.ok(anm.findeNachToken(t), "die neuen Links funktionieren");
  });

  it("lässt die alten Links gelten, wenn die Mail nicht rausgeht", async () => {
    const a = anmeldung("fehler@schule.example", "Konzert", "2099-06-01");
    const { mails } = await anfordern("fehler@schule.example", postfach("fehlgeschlagen"));
    assert.equal(mails.length, 1);
    assert.ok(anm.findeNachToken(a.token), "niemand verliert den Zugang, nur weil der Mailversand ausfällt");
    assert.ok(
      prot.listeProtokoll({ ereignisse: ["mail.fehlgeschlagen"] }).zeilen.some((z) => z.details.anlass === "Link verloren"),
      "der Fehler steht im Protokoll",
    );
  });

  it("antwortet bei unbekannten Adressen gleich und verschickt nichts", async () => {
    const { r, mails } = await anfordern("niemand@schule.example");
    assert.equal(r.ok, true);
    assert.equal(mails.length, 0);
  });

  it("erneuert nur Veranstaltungen, die noch nicht vorbei sind, auch abgelehnte", async () => {
    const alt = anmeldung("alt@schule.example", "Vergangenes", "2020-01-01");
    const abgelehnt = anmeldung("alt@schule.example", "Abgelehnt", "2099-07-01");
    anm.entscheideAnmeldung(abgelehnt.id, { status: "abgelehnt", nachricht: "", erwarteterStatus: "neu", akteur: { id: "x", name: "Team" } });
    const { mails } = await anfordern("alt@schule.example");
    assert.equal(mails.length, 1);
    assert.ok(mails[0].text.includes("Abgelehnt"));
    assert.ok(!mails[0].text.includes("Vergangenes"));
    assert.ok(anm.findeNachToken(alt.token), "vergangene Anmeldungen behalten ihren Link");
    assert.equal(anm.findeNachToken(abgelehnt.token), null);
  });

  it("prüft die Adresse und bremst Wiederholungen", async () => {
    for (const schlecht of ["", "kein-at", "a@b", "zwei@@schule.example", "mit leer@schule.example", "x".repeat(250) + "@schule.example"]) {
      const r = await zug.fordereZugangslinksAn(schlecht, kontext(), { jetzt: JETZT });
      assert.equal(r.ok, false, schlecht);
    }
    anmeldung("bremse@schule.example", "Bremse", "2099-08-01");
    assert.equal((await anfordern("bremse@schule.example")).r.ok, true);
    assert.equal((await anfordern("bremse@schule.example")).r.ok, true);
    const dritte = await anfordern("bremse@schule.example");
    assert.equal(dritte.r.ok, false, "je Adresse sind zwei Anfragen in 15 Minuten erlaubt");
    assert.ok(!dritte.r.ok && dritte.r.gedrosselt);
    const spaeter = await anfordern("bremse@schule.example", postfach(), new Date(JETZT.getTime() + 16 * 60_000));
    assert.equal(spaeter.r.ok, true);
  });

  it("bremst je IP-Adresse und schreibt die Adresse nie ins Protokoll", async () => {
    const feste = { ip: "198.51.100.9", geraet: "Test" };
    const mails = postfach();
    const jetzt = new Date(JETZT.getTime() + 60 * 60_000);
    let abgelehnt = 0;
    for (let i = 0; i < 8; i++) {
      const r = await zug.fordereZugangslinksAn(`ip${i}@schule.example`, feste, { jetzt, sende: mails.sende });
      if (!r.ok) abgelehnt += 1;
    }
    assert.equal(abgelehnt, 3, "fünf Anfragen je IP in 15 Minuten");
    const zeilen = prot.listeProtokoll({ ereignisse: ["link.angefordert"] }).zeilen;
    assert.ok(zeilen.length > 0);
    assert.ok(!JSON.stringify(zeilen).includes("schule.example"), "keine E-Mail-Adresse im Protokoll");
  });
});

describe("Mail mit neuen Links", () => {
  it("maskiert Titel und nennt jeden Link", () => {
    const m = mailZugangslinks({ eintraege: [{ titel: "<b>Konzert</b> & mehr", datum: "2099-05-01", link: "https://technik.example/anmeldung/abc" }] });
    assert.equal(m.betreff, "Ihr neuer Link zur Anmeldung");
    assert.ok(m.html.includes("&lt;b&gt;Konzert&lt;/b&gt; &amp; mehr"));
    assert.ok(!m.html.includes("<b>Konzert"));
    assert.ok(m.text.includes("https://technik.example/anmeldung/abc"));
    const zwei = mailZugangslinks({ eintraege: [1, 2].map((n) => ({ titel: `T${n}`, datum: "2099-05-01", link: `https://technik.example/anmeldung/${n}` })) });
    assert.equal(zwei.betreff, "Ihre neuen Links zu den Anmeldungen");
  });
});
