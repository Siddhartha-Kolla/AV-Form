// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  baueKalender,
  datumPlus,
  dateiname,
  ereignisseFuerAnmeldung,
  falte,
  icsText,
  zeitenAusText,
  type AnmeldungFuerKalender,
} from "../lib/kalender.ts";
import { emptyValues } from "../lib/registration.ts";

function anmeldung(teil: Partial<ReturnType<typeof emptyValues>> = {}): AnmeldungFuerKalender {
  return {
    id: "a".repeat(32),
    revision: 3,
    geaendertAm: "2026-11-10T09:30:00.000Z",
    values: {
      ...emptyValues(),
      titel: "Sommerkonzert",
      lehrkraft: "Frau Geheim",
      email: "geheim@schule.example",
      anmerkungen: "Vertrauliche Anmerkung",
      technische_details: "Vertrauliche Details",
      datum: "2026-12-04",
      beginn: "18:30",
      ende: "21:00",
      ort: "Aula",
      ...teil,
    },
  };
}

const OPT = { basisUrl: "https://technik.example", erinnerung: false };

describe("Kalender: Text und Format", () => {
  it("maskiert Sonderzeichen und entfernt Zeilenumbrüche aus Werten", () => {
    assert.equal(icsText("a;b,c\\d"), "a\\;b\\,c\\\\d");
    assert.equal(icsText("zwei\nZeilen"), "zwei\\nZeilen");
    assert.equal(icsText("x\u0000y"), "xy");
  });

  it("bricht lange Zeilen nach 75 Byte um, ohne ein Zeichen zu zerteilen", () => {
    const lang = "DESCRIPTION:" + "Überprüfung für Bühne ".repeat(12);
    const gefaltet = falte(lang);
    for (const zeile of gefaltet.split("\r\n")) assert.ok(new TextEncoder().encode(zeile).length <= 75, zeile);
    assert.equal(gefaltet.replaceAll("\r\n ", ""), lang, "entfaltet ergibt sich wieder der Text");
    assert.equal(falte("kurz"), "kurz");
  });

  it("rechnet mit Datum und Uhrzeit", () => {
    assert.equal(datumPlus("2026-12-31", 1), "2027-01-01");
    assert.equal(datumPlus("2026-03-01", -30), "2026-01-30");
    assert.deepEqual(zeitenAusText("17:00 bis 19.30 Uhr"), ["17:00", "19:30"]);
    assert.deepEqual(zeitenAusText("ab 9:15"), ["09:15"]);
    assert.deepEqual(zeitenAusText("nach dem Unterricht"), []);
  });

  it("macht aus dem Titel einen sicheren Dateinamen", () => {
    assert.equal(dateiname("Sommerkonzert: Klasse 7/8 für Eltern"), "Sommerkonzert-Klasse-7-8-fur-Eltern.ics");
    assert.equal(dateiname("???"), "veranstaltung.ics");
  });
});

describe("Kalender: Einträge einer Anmeldung", () => {
  it("macht aus der Veranstaltung einen Eintrag mit Zeit, Ort und Link", () => {
    const [e, ...rest] = ereignisseFuerAnmeldung(anmeldung(), OPT);
    assert.equal(rest.length, 0);
    assert.equal(e.titel, "Sommerkonzert");
    assert.deepEqual(e.beginn, { datum: "2026-12-04", zeit: "18:30" });
    assert.deepEqual(e.ende, { datum: "2026-12-04", zeit: "21:00" });
    assert.equal(e.ort, "Aula");
    assert.equal(e.sequenz, 3);
    assert.ok(e.beschreibung.includes("https://technik.example/team/anmeldungen/" + "a".repeat(32)));
  });

  it("lässt eine Veranstaltung über Mitternacht am nächsten Tag enden", () => {
    const [e] = ereignisseFuerAnmeldung(anmeldung({ beginn: "20:00", ende: "00:30" }), OPT);
    assert.deepEqual(e.ende, { datum: "2026-12-05", zeit: "00:30" });
  });

  it("nimmt Termine aus dem Ablauf als eigene Einträge, aber nur mit echtem Datum", () => {
    const v = emptyValues();
    const ereignisse = ereignisseFuerAnmeldung(
      anmeldung({
        termine: {
          ...v.termine,
          probe: { datum: "jeden Dienstag", uhrzeit: "15:00", ort: "Aula" },
          generalprobe: { datum: "2026-12-03", uhrzeit: "17:00 bis 19:30 Uhr", ort: "" },
          aufbau: { datum: "2026-12-04", uhrzeit: "", ort: "Bühne" },
          abbau: { datum: "2026-12-04", uhrzeit: "21:30", ort: "" },
        },
      }),
      OPT,
    );
    assert.deepEqual(
      ereignisse.map((e) => e.titel),
      ["Sommerkonzert", "Generalprobe: Sommerkonzert", "Aufbau: Sommerkonzert", "Abbau: Sommerkonzert"],
    );
    const [, general, aufbau, abbau] = ereignisse;
    assert.deepEqual([general.beginn.zeit, general.ende.zeit], ["17:00", "19:30"]);
    assert.equal(general.ort, "Aula", "ohne eigenen Ort gilt der Ort der Veranstaltung");
    assert.equal(aufbau.beginn.zeit, null, "ohne Uhrzeit ganztägig");
    assert.deepEqual(aufbau.ende, { datum: "2026-12-05", zeit: null });
    assert.deepEqual([abbau.beginn.zeit, abbau.ende.zeit], ["21:30", "22:30"], "ohne Ende eine Stunde");
    assert.equal(new Set(ereignisse.map((e) => e.uid)).size, 4, "jede Kennung ist eindeutig");
  });

  it("zeigt Pflicht und Besetzung, aber nie Lehrkraft, E-Mail, Anmerkungen oder Details", () => {
    const e = ereignisseFuerAnmeldung(anmeldung(), { ...OPT, besetzung: { pflicht: true, benoetigt: 4, dabei: 2 } })[0];
    assert.equal(e.titel, "Pflicht: Sommerkonzert");
    assert.ok(e.beschreibung.includes("Besetzung: Pflicht, 2 von 4 dabei"));
    const datei = baueKalender({ name: "Technikteam", ereignisse: [e] });
    for (const geheim of ["Geheim", "schule.example", "Vertrauliche"]) assert.ok(!datei.includes(geheim), geheim);
  });

  it("gibt bei einem ungültigen Datum nichts aus", () => {
    assert.deepEqual(ereignisseFuerAnmeldung(anmeldung({ datum: "" }), OPT), []);
  });
});

describe("Kalender: die Datei", () => {
  it("hat Kopf, Zeitzone, CRLF und kein einzelnes LF", () => {
    const datei = baueKalender({ name: "Technikteam", ereignisse: ereignisseFuerAnmeldung(anmeldung(), OPT) });
    assert.ok(datei.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    assert.ok(datei.endsWith("END:VCALENDAR\r\n"));
    assert.ok(datei.includes("BEGIN:VTIMEZONE\r\nTZID:Europe/Berlin"));
    assert.ok(datei.includes("DTSTART;TZID=Europe/Berlin:20261204T183000"));
    assert.ok(datei.includes("DTEND;TZID=Europe/Berlin:20261204T210000"));
    assert.ok(datei.includes("DTSTAMP:20261110T093000Z"));
    assert.ok(datei.includes("SEQUENCE:3"));
    assert.ok(!/(^|[^\r])\n/.test(datei), "jedes Zeilenende ist CRLF");
    assert.ok(!datei.includes("BEGIN:VALARM"));
  });

  it("schreibt Ganztägiges als Datum und die Erinnerung am Vortag", () => {
    const v = emptyValues();
    const ereignisse = ereignisseFuerAnmeldung(
      anmeldung({ termine: { ...v.termine, aufbau: { datum: "2026-12-04", uhrzeit: "", ort: "" } } }),
      { ...OPT, erinnerung: true },
    );
    const datei = baueKalender({ name: "Technikteam", ereignisse });
    assert.ok(datei.includes("DTSTART;VALUE=DATE:20261204\r\nDTEND;VALUE=DATE:20261205"));
    assert.equal(datei.split("BEGIN:VALARM").length - 1, 1, "nur der Haupttermin bekommt eine Erinnerung");
    assert.ok(datei.includes("TRIGGER:-P1D"));
  });

  it("lässt sich über den Titel keine neuen Zeilen oder Einträge einschleusen", () => {
    const boese = anmeldung({ titel: "Konzert\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Falsch", ort: "Aula;\nX-HACK:1" });
    const datei = baueKalender({ name: "Technikteam", ereignisse: ereignisseFuerAnmeldung(boese, OPT) });
    assert.equal(datei.split(/\r?\n/).filter((zeile) => zeile === "BEGIN:VEVENT").length, 1);
    assert.ok(!datei.includes("\r\nX-HACK"));
    assert.ok(!datei.includes("\r\nSUMMARY:Falsch"));
  });
});
