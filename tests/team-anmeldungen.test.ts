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

function eingabe(a: NonNullable<ReturnType<typeof anm.findeNachId>>, aenderung: Record<string, unknown> = {}, extra: object = {}) {
  return {
    values: { ...a.values, ...aenderung },
    revision: a.revision,
    notiz: "",
    entferneDateiIds: [] as string[],
    neueDateien: [] as { name: string; inhalt: Buffer }[],
    ...extra,
  };
}

describe("Bearbeiten durch das Team", () => {
  it("speichert Änderungen, fügt Dateien hinzu und vermerkt wer es war und warum", () => {
    const { id } = neueAnmeldung();
    const a = anm.findeNachId(id)!;
    const ergebnis = team.bearbeiteFuerTeam(
      mitglied,
      id,
      eingabe(a, { ort: "Turnhalle", mikrofone_anzahl: "4", tech: { mikrofone: true } }, {
        notiz: "Per E-Mail von Frau Test gemeldet",
        neueDateien: [{ name: "Neuer Plan.pdf", inhalt: Buffer.from("Inhalt") }],
      }),
      kontext,
    );
    assert.ok(ergebnis.ok);
    if (!ergebnis.ok) return;
    assert.deepEqual([...ergebnis.geaendert].sort(), ["datei+", "mikrofone_anzahl", "ort", "tech"]);

    const danach = anm.findeNachId(id)!;
    assert.equal(danach.values.ort, "Turnhalle");
    assert.equal(danach.revision, a.revision + 1);
    assert.equal(dat.listeDateien(id).length, 1);

    const verlauf = team.oeffneFuerTeam(mitglied, id, kontext)!.aenderungen[0];
    assert.equal(verlauf.von, "Mitglied");
    assert.equal(verlauf.notiz, "Per E-Mail von Frau Test gemeldet");
    assert.deepEqual(verlauf.dateienHinzu, ["Neuer Plan.pdf"]);

    const eintrag = prot.listeProtokoll({ ereignisse: ["anmeldung.bearbeitet"] }).zeilen[0];
    assert.equal(eintrag.akteurName, "Mitglied");
    assert.equal(eintrag.zielName, "Sommerkonzert");
  });

  it("entfernt Dateien samt Datei auf der Platte und ersetzt auch bei voller Dateiliste", () => {
    const { id } = neueAnmeldung();
    const infos = Array.from({ length: 10 }, (_, i) => dat.speichereDatei(id, `Datei${i}.pdf`, Buffer.from("x")));
    const a = anm.findeNachId(id)!;
    const pfad = path.join(dir, "dateien", `${infos[0].id}.bin`);
    assert.ok(fs.existsSync(pfad));

    const ersetzen = team.bearbeiteFuerTeam(
      mitglied,
      id,
      eingabe(a, {}, { entferneDateiIds: [infos[0].id], neueDateien: [{ name: "Ersatz.pdf", inhalt: Buffer.from("neu") }] }),
      kontext,
    );
    assert.ok(ersetzen.ok);
    assert.ok(!fs.existsSync(pfad));
    assert.equal(dat.listeDateien(id).length, 10);

    const a2 = anm.findeNachId(id)!;
    const zuViel = team.bearbeiteFuerTeam(mitglied, id, eingabe(a2, {}, { neueDateien: [{ name: "Elf.pdf", inhalt: Buffer.from("x") }] }), kontext);
    assert.ok(!zuViel.ok && zuViel.dateiFehler?.some((m) => m.includes("höchstens")));
    assert.equal(dat.listeDateien(id).length, 10);
  });

  it("verändert nichts, wenn etwas nicht stimmt", () => {
    const { id } = neueAnmeldung();
    const vorhanden = dat.speichereDatei(id, "Bleibt.pdf", Buffer.from("x"));
    const a = anm.findeNachId(id)!;

    const schlecht = team.bearbeiteFuerTeam(
      mitglied,
      id,
      eingabe(a, { ort: "Neu" }, { neueDateien: [{ name: "virus.exe", inhalt: Buffer.from("x") }, { name: "gut.pdf", inhalt: Buffer.from("x") }] }),
      kontext,
    );
    assert.ok(!schlecht.ok && schlecht.dateiFehler?.[0].includes("virus.exe"));
    assert.equal(anm.findeNachId(id)!.values.ort, "Aula");
    assert.deepEqual(dat.listeDateien(id).map((d) => d.name), ["Bleibt.pdf"]);

    const ohneTitel = team.bearbeiteFuerTeam(mitglied, id, eingabe(a, { titel: "  " }), kontext);
    assert.ok(!ohneTitel.ok && ohneTitel.fehler?.titel);

    const unbekannteDatei = team.bearbeiteFuerTeam(mitglied, id, eingabe(a, {}, { entferneDateiIds: ["0".repeat(32)] }), kontext);
    assert.ok(!unbekannteDatei.ok && unbekannteDatei.dateiFehler);
    assert.equal(dat.listeDateien(id)[0].id, vorhanden.id);
  });

  it("erkennt, wenn zwischendurch jemand anderes gespeichert hat", () => {
    const { id } = neueAnmeldung();
    const a = anm.findeNachId(id)!;
    assert.ok(team.bearbeiteFuerTeam(mitglied, id, eingabe(a, { ort: "Erste Änderung" }), kontext).ok);
    const zweite = team.bearbeiteFuerTeam(chef, id, eingabe(a, { ort: "Zweite Änderung" }), kontext);
    assert.ok(!zweite.ok && zweite.meldung?.includes("inzwischen geändert"));
    assert.equal(anm.findeNachId(id)!.values.ort, "Erste Änderung");
  });

  it("bereinigt Eingaben von außen und erlaubt vergangene Termine", () => {
    const { id } = neueAnmeldung();
    const a = anm.findeNachId(id)!;
    const ergebnis = team.bearbeiteFuerTeam(
      mitglied,
      id,
      eingabe(a, {
        datum: "2020-05-05",
        arten: ["konzert", "konzert"],
        tech: { mikrofone: true, hacker: true, licht_buehne: false },
        mikrofone_anzahl: "3",
        titel: "  Mit Rand  ",
      }),
      kontext,
    );
    assert.ok(ergebnis.ok);
    const danach = anm.findeNachId(id)!.values;
    assert.equal(danach.datum, "2020-05-05");
    assert.deepEqual(danach.arten, ["konzert"]);
    assert.deepEqual(danach.tech, { mikrofone: true });
    assert.equal(danach.titel, "Mit Rand");

    const zuLang = team.bearbeiteFuerTeam(mitglied, id, eingabe(anm.findeNachId(id)!, { titel: "x".repeat(300) }), kontext);
    assert.ok(!zuLang.ok && zuLang.meldung);
    const muell = team.bearbeiteFuerTeam(mitglied, id, { ...eingabe(anm.findeNachId(id)!), values: "kein Objekt" }, kontext);
    assert.ok(!muell.ok);
  });

  it("verlangt die Berechtigung", () => {
    const { id } = neueAnmeldung();
    const a = anm.findeNachId(id)!;
    const ohne = { ...mitglied, rolle: "gibtsnicht" } as unknown as typeof mitglied;
    assert.throws(() => team.bearbeiteFuerTeam(ohne, id, eingabe(a, { ort: "X" }), kontext), FachFehler);
    assert.throws(() => team.ladeZumBearbeiten(ohne, id), FachFehler);
    assert.ok(team.ladeZumBearbeiten(mitglied, id));
  });
});

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

describe("Entscheidung des Teams", () => {
  const neu = () => neueAnmeldung().id;

  it("nimmt an, stellt Rückfragen, lehnt ab und hält Person, Zeit und Nachricht fest", () => {
    const id = neu();
    assert.equal(anm.findeNachId(id)!.status, "neu");

    assert.ok(team.entscheideFuerTeam(mitglied, id, { status: "rueckfrage", nachricht: " Bitte den Ablaufplan nachreichen. ", erwarteterStatus: "neu" }, kontext).ok);
    assert.equal(anm.findeNachId(id)!.status, "rueckfrage");
    assert.ok(team.entscheideFuerTeam(chef, id, { status: "angenommen", nachricht: "", erwarteterStatus: "rueckfrage" }, kontext).ok);
    assert.ok(team.entscheideFuerTeam(chef, id, { status: "abgelehnt", nachricht: "Die Aula ist belegt.", erwarteterStatus: "angenommen" }, kontext).ok);
    assert.equal(anm.findeNachId(id)!.status, "abgelehnt");

    const verlauf = team.oeffneFuerTeam(mitglied, id, kontext)!.entscheidungen;
    assert.deepEqual(verlauf.map((e) => e.status), ["abgelehnt", "angenommen", "rueckfrage"]);
    assert.equal(verlauf[0].von, "Chef");
    assert.equal(verlauf[0].nachricht, "Die Aula ist belegt.");
    assert.equal(verlauf[1].nachricht, null);
    assert.equal(verlauf[2].nachricht, "Bitte den Ablaufplan nachreichen.");

    const eintraege = prot.listeProtokoll({ ereignisse: ["anmeldung.entschieden"] }).zeilen;
    assert.ok(eintraege.length >= 3);
    assert.equal(eintraege[0].details.status, "abgelehnt");
  });

  it("verlangt bei einer Rückfrage eine Nachricht und prüft die Eingabe", () => {
    const id = neu();
    const ohne = team.entscheideFuerTeam(mitglied, id, { status: "rueckfrage", nachricht: "   ", erwarteterStatus: "neu" }, kontext);
    assert.ok(!ohne.ok && ohne.meldung.includes("klären"));
    const unbekannt = team.entscheideFuerTeam(mitglied, id, { status: "neu", nachricht: "", erwarteterStatus: "neu" }, kontext);
    assert.ok(!unbekannt.ok);
    const zuLang = team.entscheideFuerTeam(mitglied, id, { status: "abgelehnt", nachricht: "x".repeat(1001), erwarteterStatus: "neu" }, kontext);
    assert.ok(!zuLang.ok);
    assert.equal(anm.findeNachId(id)!.status, "neu");
  });

  it("verhindert, dass zwei Personen sich gegenseitig überstimmen", () => {
    const id = neu();
    assert.ok(team.entscheideFuerTeam(mitglied, id, { status: "angenommen", nachricht: "", erwarteterStatus: "neu" }, kontext).ok);
    const zweite = team.entscheideFuerTeam(chef, id, { status: "abgelehnt", nachricht: "", erwarteterStatus: "neu" }, kontext);
    assert.ok(!zweite.ok && zweite.meldung.includes("inzwischen"));
    assert.equal(anm.findeNachId(id)!.status, "angenommen");
  });

  it("setzt Angenommenes auf Zu prüfen zurück, wenn die Lehrkraft etwas ändert, Abgelehntes aber nicht", () => {
    const id = neu();
    team.entscheideFuerTeam(mitglied, id, { status: "angenommen", nachricht: "", erwarteterStatus: "neu" }, kontext);
    const a = anm.findeNachId(id)!;
    anm.aktualisiereAnmeldung(id, { ...a.values, ort: "Turnhalle" });
    assert.equal(anm.findeNachId(id)!.status, "neu");
    assert.equal(anm.listeEntscheidungen(id)[0].von, null);

    // Eine Änderung durch das Team lässt die Entscheidung unberührt.
    team.entscheideFuerTeam(mitglied, id, { status: "angenommen", nachricht: "", erwarteterStatus: "neu" }, kontext);
    const b = anm.findeNachId(id)!;
    assert.ok(team.bearbeiteFuerTeam(mitglied, id, eingabe(b, { ort: "Aula" }), kontext).ok);
    assert.equal(anm.findeNachId(id)!.status, "angenommen");

    team.entscheideFuerTeam(mitglied, id, { status: "abgelehnt", nachricht: "", erwarteterStatus: "angenommen" }, kontext);
    const c = anm.findeNachId(id)!;
    anm.aktualisiereAnmeldung(id, { ...c.values, ort: "Foyer" });
    assert.equal(anm.findeNachId(id)!.status, "abgelehnt");
  });

  it("verlangt die Berechtigung und nimmt eine gelöschte Anmeldung nicht an", () => {
    const id = neu();
    const ohne = { ...mitglied, rolle: "gibtsnicht" } as unknown as typeof mitglied;
    assert.throws(() => team.entscheideFuerTeam(ohne, id, { status: "angenommen", nachricht: "", erwarteterStatus: "neu" }, kontext), FachFehler);
    anm.loescheAnmeldung(id);
    const weg = team.entscheideFuerTeam(mitglied, id, { status: "angenommen", nachricht: "", erwarteterStatus: "neu" }, kontext);
    assert.ok(!weg.ok);
  });

  it("löscht den Entscheidungsverlauf mit der Anmeldung", () => {
    const id = neu();
    team.entscheideFuerTeam(mitglied, id, { status: "angenommen", nachricht: "ok", erwarteterStatus: "neu" }, kontext);
    anm.loescheAnmeldung(id);
    assert.equal(anm.listeEntscheidungen(id).length, 0);
  });
});

describe("Öffentliche Belegung", () => {
  it("liefert nur Datum und Uhrzeit, ohne Abgelehntes und nur im Zeitraum", () => {
    const werte = { ...emptyValues(), titel: "Geheimer Titel", lehrkraft: "Frau Geheim", email: "g@schule.example", beginn: "18:00", ende: "20:00", ort: "Aula", arten: ["konzert" as const] };
    const gut = anm.erstelleAnmeldung({ ...werte, datum: "2098-03-10" });
    const abgelehnt = anm.erstelleAnmeldung({ ...werte, datum: "2098-03-11" });
    anm.erstelleAnmeldung({ ...werte, datum: "2098-09-01" }); // außerhalb des Zeitraums
    anm.entscheideAnmeldung(abgelehnt.id, { status: "abgelehnt", nachricht: "", erwarteterStatus: "neu", akteur: { id: "x", name: "X" } });
    void gut;

    const liste = anm.listeBelegung("2098-03-01", "2098-03-31");
    assert.deepEqual(liste, [{ datum: "2098-03-10", beginn: "18:00", ende: "20:00" }]);
    assert.ok(!JSON.stringify(liste).includes("Geheim"));
  });
});
