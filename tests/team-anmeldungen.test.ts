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

const { dbSchliessen, db: dbRoh } = await import("../lib/server/db.ts");
const { emptyValues } = await import("../lib/registration.ts");
const anm = await import("../lib/server/anmeldungen.ts");
const dat = await import("../lib/server/dateien.ts");
const team = await import("../lib/server/team-anmeldungen.ts");
const einr = await import("../lib/server/einreichen.ts");
const lehr = await import("../lib/server/lehrkraft.ts");
const prot = await import("../lib/server/auth/protokoll.ts");
const verw = await import("../lib/server/auth/verwaltung.ts");
const konten = await import("../lib/server/auth/konten.ts");
const ein = await import("../lib/server/einsaetze.ts");
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

describe("Anmeldung durch die Lehrkraft", () => {
  const gueltig = { ...emptyValues(), titel: "Elternabend", lehrkraft: "Herr Test", email: "h@schule.example", datum: "2099-05-04", beginn: "19:00", ende: "21:00", ort: "Mensa", arten: ["info"] };
  const ip = (n: number) => ({ ip: `198.51.100.${n}`, geraet: "Test" });

  it("legt die Anmeldung samt Dateien an und protokolliert sie", async () => {
    const ergebnis = await einr.reicheAnmeldungEin(
      { values: gueltig, dateien: [{ name: "Ablauf.pdf", inhalt: Buffer.from("x") }] },
      ip(1),
    );
    assert.ok(ergebnis.ok);
    const treffer = anm.listeAnmeldungen().anmeldungen.find((a) => a.values.titel === "Elternabend")!;
    assert.equal(treffer.status, "neu");
    assert.equal(dat.listeDateien(treffer.id).length, 1);
    assert.equal(prot.listeProtokoll({ ereignisse: ["anmeldung.eingegangen"] }).zeilen.length >= 1, true);
  });

  it("weist ungültige Angaben ab und speichert dann nichts", async () => {
    const vorher = anm.listeAnmeldungen().anmeldungen.length;
    const ohneTitel = await einr.reicheAnmeldungEin({ values: { ...gueltig, titel: "  " }, dateien: [] }, ip(2));
    assert.ok(!ohneTitel.ok && ohneTitel.fehler?.titel);
    const vergangen = await einr.reicheAnmeldungEin({ values: { ...gueltig, datum: "2020-01-01" }, dateien: [] }, ip(2));
    assert.ok(!vergangen.ok && vergangen.fehler?.datum);
    const virus = await einr.reicheAnmeldungEin({ values: gueltig, dateien: [{ name: "virus.exe", inhalt: Buffer.from("x") }] }, ip(2));
    assert.ok(!virus.ok && virus.dateiFehler?.[0].includes("virus.exe"));
    const muell = await einr.reicheAnmeldungEin({ values: "kein Objekt", dateien: [] }, ip(2));
    assert.ok(!muell.ok);
    assert.equal(anm.listeAnmeldungen().anmeldungen.length, vorher);
  });

  it("bremst zu viele Einreichungen von derselben Adresse", async () => {
    for (let i = 0; i < 6; i++) assert.ok((await einr.reicheAnmeldungEin({ values: { ...gueltig, titel: `Serie ${i}` }, dateien: [] }, ip(3))).ok);
    const zuViele = await einr.reicheAnmeldungEin({ values: gueltig, dateien: [] }, ip(3));
    assert.ok(!zuViele.ok && zuViele.meldung?.includes("zu viele"));
    // Eine andere Adresse ist nicht betroffen.
    assert.ok((await einr.reicheAnmeldungEin({ values: gueltig, dateien: [] }, ip(4))).ok);
  });
});

describe("Privater Link der Lehrkraft", () => {
  const neu = () => neueAnmeldung();

  it("zeigt nur die eigene Anmeldung und kennt ungültige Links nicht", () => {
    const { id, token } = neu();
    const ansicht = lehr.ladeFuerLehrkraft(token)!;
    assert.equal(ansicht.anmeldung.id, id);
    assert.equal(ansicht.kannAendern, true);
    assert.equal(lehr.ladeFuerLehrkraft("x".repeat(43)), null);
    assert.equal(lehr.ladeFuerLehrkraft("kurz"), null);
  });

  it("zeigt die Nachricht des Teams zur aktuellen Entscheidung", () => {
    const { id, token } = neu();
    team.entscheideFuerTeam(mitglied, id, { status: "rueckfrage", nachricht: "Bitte Ablaufplan nachreichen.", erwarteterStatus: "neu" }, kontext);
    const ansicht = lehr.ladeFuerLehrkraft(token)!;
    assert.equal(ansicht.anmeldung.status, "rueckfrage");
    assert.equal(ansicht.entscheidung?.nachricht, "Bitte Ablaufplan nachreichen.");
  });

  it("lässt die Lehrkraft ändern und setzt Angenommenes auf Zu prüfen zurück", () => {
    const { id, token } = neu();
    team.entscheideFuerTeam(mitglied, id, { status: "angenommen", nachricht: "", erwarteterStatus: "neu" }, kontext);
    const a = anm.findeNachId(id)!;
    const ergebnis = lehr.bearbeiteFuerLehrkraft(
      token,
      { ...eingabe(a, { ort: "Foyer" }), notiz: "sollte ignoriert werden", neueDateien: [{ name: "Skript.pdf", inhalt: Buffer.from("x") }] },
      kontext,
    );
    assert.ok(ergebnis.ok);
    const danach = anm.findeNachId(id)!;
    assert.equal(danach.values.ort, "Foyer");
    assert.equal(danach.status, "neu");
    assert.equal(dat.listeDateien(id).length, 1);
    const verlauf = anm.listeAenderungen(id)[0];
    assert.equal(verlauf.von, null);
    assert.equal(verlauf.notiz, null);
    assert.equal(prot.listeProtokoll({ ereignisse: ["anmeldung.von_lehrkraft_geaendert"] }).zeilen.length >= 1, true);
  });

  it("verweigert Änderungen an Abgelehntem, an Vergangenem und mit veraltetem Stand", () => {
    const abgelehnt = neu();
    team.entscheideFuerTeam(mitglied, abgelehnt.id, { status: "abgelehnt", nachricht: "", erwarteterStatus: "neu" }, kontext);
    const a = anm.findeNachId(abgelehnt.id)!;
    const r1 = lehr.bearbeiteFuerLehrkraft(abgelehnt.token, eingabe(a, { ort: "X" }), kontext);
    assert.ok(!r1.ok && r1.meldung?.includes("abgelehnt"));
    assert.equal(lehr.ladeFuerLehrkraft(abgelehnt.token)!.kannAendern, false);

    const alt = anm.erstelleAnmeldung({ ...emptyValues(), titel: "Alt", lehrkraft: "L", email: "a@schule.example", datum: "2020-01-01", beginn: "10:00", ende: "11:00", ort: "Aula", arten: ["konzert"] });
    const b = anm.findeNachId(alt.id)!;
    const r2 = lehr.bearbeiteFuerLehrkraft(alt.token, eingabe(b, { ort: "X" }), kontext);
    assert.ok(!r2.ok && r2.meldung?.includes("Vergangenheit"));

    const aktuell = neu();
    const c = anm.findeNachId(aktuell.id)!;
    assert.ok(team.bearbeiteFuerTeam(mitglied, aktuell.id, eingabe(c, { ort: "Team-Ort" }), kontext).ok);
    const r3 = lehr.bearbeiteFuerLehrkraft(aktuell.token, eingabe(c, { ort: "Lehrkraft-Ort" }), kontext);
    assert.ok(!r3.ok && r3.meldung?.includes("inzwischen geändert"));
    assert.equal(anm.findeNachId(aktuell.id)!.values.ort, "Team-Ort");
  });

  it("verlangt für eine Vergangenheit-Änderung des Datums einen künftigen Tag", () => {
    const { id, token } = neu();
    const a = anm.findeNachId(id)!;
    const r = lehr.bearbeiteFuerLehrkraft(token, eingabe(a, { datum: "2020-02-02" }), kontext);
    assert.ok(!r.ok && r.fehler?.datum);
  });
});

describe("Besetzung", () => {
  const meinKonto = () => konten.findeKonto(mitglied.id)!;
  const chefKonto = () => konten.findeKonto(chef.id)!;

  it("lässt jeden für sich antworten und zeigt den Stand, ohne dass etwas ins Protokoll muss", () => {
    const { id } = neueAnmeldung();
    const vorher = ein.ladeBesetzung(mitglied, id);
    assert.equal(vorher.pflicht, false);
    assert.ok(vorher.personen.every((p) => p.antwort === "offen"));
    assert.equal(vorher.personen[0].kontoId, mitglied.id, "man selbst steht zuerst");

    const protokollVorher = prot.listeProtokoll({ ereignisse: ["einsatz.geaendert"] }).zeilen.length;
    ein.setzeAntwort(mitglied, id, mitglied.id, { antwort: "dabei", notiz: "Ab 17 Uhr" }, kontext);
    const danach = ein.ladeBesetzung(mitglied, id).personen.find((p) => p.kontoId === mitglied.id)!;
    assert.equal(danach.antwort, "dabei");
    assert.equal(danach.notiz, "Ab 17 Uhr");
    assert.equal(prot.listeProtokoll({ ereignisse: ["einsatz.geaendert"] }).zeilen.length, protokollVorher, "gewöhnliche Antworten füllen das Protokoll nicht");

    // Ändern statt doppelt eintragen, und die Notiz wird mit ersetzt.
    ein.setzeAntwort(mitglied, id, mitglied.id, { antwort: "nicht_dabei", notiz: "" }, kontext);
    const nochmal = ein.ladeBesetzung(mitglied, id).personen.find((p) => p.kontoId === mitglied.id)!;
    assert.equal(nochmal.antwort, "nicht_dabei");
    assert.equal(nochmal.notiz, null);
  });

  it("legt die Notiz verschlüsselt ab", () => {
    const { id } = neueAnmeldung();
    ein.setzeAntwort(mitglied, id, mitglied.id, { antwort: "dabei", notiz: "Geheimnotiz XYZ" }, kontext);
    const roh = (dbRoh().prepare("SELECT notiz FROM einsaetze WHERE anmeldung_id = ?").get(id) as { notiz: Buffer }).notiz;
    assert.ok(!roh.includes(Buffer.from("Geheimnotiz")), "die Notiz steht im Klartext in der Datenbank");
  });

  it("verlangt für andere und für die Planung die Berechtigung", () => {
    const { id } = neueAnmeldung();
    assert.throws(() => ein.setzeAntwort(mitglied, id, chef.id, { antwort: "dabei", notiz: "" }, kontext), /Berechtigung/);
    assert.throws(() => ein.setzePlanung(mitglied, id, { pflicht: true, benoetigt: 3 }, kontext), /Berechtigung/);
    // Der Superuser darf beides und trägt für andere ein. Das steht dann im Protokoll.
    ein.setzeAntwort(chefKonto(), id, mitglied.id, { antwort: "dabei", notiz: "" }, kontext);
    assert.equal(ein.ladeBesetzung(chefKonto(), id).personen.find((p) => p.kontoId === mitglied.id)!.antwort, "dabei");
    const z = prot.listeProtokoll({ ereignisse: ["einsatz.geaendert"] }).zeilen;
    assert.ok(z.some((r) => r.details.fuer === "Mitglied"));
  });

  it("macht eine Veranstaltung zur Pflicht: Ein Nein braucht dann eine Begründung und alles wird protokolliert", () => {
    const { id } = neueAnmeldung();
    ein.setzePlanung(chefKonto(), id, { pflicht: true, benoetigt: 2 }, kontext);
    const plan = ein.ladeBesetzung(chefKonto(), id);
    assert.equal(plan.pflicht, true);
    assert.equal(plan.benoetigt, 2);
    assert.throws(() => ein.setzeAntwort(mitglied, id, mitglied.id, { antwort: "nicht_dabei", notiz: "" }, kontext), /warum/);
    ein.setzeAntwort(mitglied, id, mitglied.id, { antwort: "nicht_dabei", notiz: "Klausur" }, kontext);
    assert.ok(prot.listeProtokoll({ ereignisse: ["einsatz.geplant"] }).zeilen.length >= 1);
    assert.ok(prot.listeProtokoll({ ereignisse: ["einsatz.geaendert"] }).zeilen.some((r) => r.details.pflicht === "ja"));
    // Zurück auf "keine Planung" räumt die Zeile auf.
    ein.setzePlanung(chefKonto(), id, { pflicht: false, benoetigt: "" }, kontext);
    assert.equal(ein.ladeBesetzung(chefKonto(), id).pflicht, false);
    assert.throws(() => ein.setzePlanung(chefKonto(), id, { pflicht: true, benoetigt: 0 }, kontext), /zwischen/);
  });

  it("sperrt Abgelehntes und Vergangenes und zählt Gesperrte nicht mit", async () => {
    const { id } = neueAnmeldung();
    team.entscheideFuerTeam(mitglied, id, { status: "abgelehnt", nachricht: "", erwarteterStatus: "neu" }, kontext);
    assert.throws(() => ein.setzeAntwort(mitglied, id, mitglied.id, { antwort: "dabei", notiz: "" }, kontext), /abgelehnt/);
    const alt = anm.erstelleAnmeldung({ ...emptyValues(), titel: "Alt", lehrkraft: "L", email: "a@schule.example", datum: "2020-01-01", beginn: "10:00", ende: "11:00", ort: "Aula", arten: ["konzert"] });
    assert.throws(() => ein.setzeAntwort(mitglied, alt.id, mitglied.id, { antwort: "dabei", notiz: "" }, kontext), /Vergangenheit/);

    const offen = neueAnmeldung();
    const { konto: extra } = await verw.legeMitgliedAn(chef, { benutzername: "extra", anzeigename: "Extra", rolle: "mitglied" }, kontext);
    assert.ok(ein.ladeBesetzung(chefKonto(), offen.id).personen.some((p) => p.kontoId === extra.id));
    ein.setzeAntwort(extra, offen.id, extra.id, { antwort: "dabei", notiz: "" }, kontext);
    assert.equal(ein.besetzungenFuerListe(chefKonto())(offen.id).dabei, 1);
    verw.setzeMitgliedStatus(chef, extra.id, "gesperrt", kontext);
    assert.ok(!ein.ladeBesetzung(chefKonto(), offen.id).personen.some((p) => p.kontoId === extra.id), "Gesperrte zählen nicht zur Besetzung");
    assert.equal(ein.besetzungenFuerListe(chefKonto())(offen.id).dabei, 0);
    assert.throws(() => ein.setzeAntwort(chefKonto(), offen.id, extra.id, { antwort: "dabei", notiz: "" }, kontext), /gesperrt/);
  });

  it("zählt den Superuser nicht zur Besetzung, er kann aber planen und für andere eintragen", () => {
    const { id } = neueAnmeldung();
    const personen = ein.ladeBesetzung(chefKonto(), id).personen;
    assert.ok(!personen.some((p) => p.kontoId === chef.id));
    assert.ok(personen.some((p) => p.kontoId === mitglied.id));
    assert.throws(() => ein.setzeAntwort(chefKonto(), id, chef.id, { antwort: "dabei", notiz: "" }, kontext), /Besetzung/);
  });

  it("räumt mit der Anmeldung auf, und die Übersicht kennt meine Antwort", () => {
    const { id } = neueAnmeldung();
    ein.setzeAntwort(meinKonto(), id, mitglied.id, { antwort: "dabei", notiz: "" }, kontext);
    assert.equal(ein.besetzungenFuerListe(meinKonto())(id).meine, "dabei");
    assert.equal(ein.besetzungenFuerListe(chefKonto())(id).meine, null, "der Superuser zählt nicht zur Besetzung");
    anm.loescheAnmeldung(id);
    assert.equal((dbRoh().prepare("SELECT COUNT(*) AS n FROM einsaetze WHERE anmeldung_id = ?").get(id) as { n: number }).n, 0);
  });
});
