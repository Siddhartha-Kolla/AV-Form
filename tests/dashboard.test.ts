// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alsListeneintrag,
  betreuungKurz,
  feldBezeichnung,
  betreuungNoetig,
  antwortFehlt,
  filtere,
  gruppiere,
  juengsteAenderung,
  knappAngemeldet,
  nachMonat,
  technikGruppen,
  technikKurz,
  terminListe,
  unterlagenFehlen,
  zusammenfassung,
  type Listeneintrag,
} from "../lib/dashboard.ts";
import { datumTeile, heuteBerlin, inTagen, tageZwischen } from "../lib/format.ts";
import { emptyValues, type FormValues } from "../lib/registration.ts";

const HEUTE = "2026-11-15";

function eintrag(id: string, teil: Partial<FormValues>, extra: Partial<Listeneintrag> = {}): Listeneintrag {
  return {
    id,
    status: "neu",
    values: { ...emptyValues(), titel: id, lehrkraft: "Frau Test", ort: "Aula", beginn: "18:00", ende: "20:00", ...teil },
    erstelltAm: "2026-10-01T10:00:00.000Z",
    dateienAnzahl: 0,
    aenderungen: [],
    ...extra,
  };
}

const liste = [
  eintrag("alt", { datum: "2026-10-20", arten: ["theater"] }),
  eintrag("bald", { datum: "2026-11-20", arten: ["konzert"], lehrkraft: "Herr Maier", ort: "Turnhalle" }),
  eintrag("spaeter", { datum: "2026-12-05", beginn: "09:00", arten: ["vortrag", "info"] }),
  eintrag("spaeter2", { datum: "2026-12-05", beginn: "08:00", arten: ["podium"] }),
  eintrag("heute", { datum: HEUTE, arten: ["sonstiges"], art_sonstiges: "Verabschiedung" }),
];

describe("Filtern und Sortieren", () => {
  it("zeigt standardmäßig Anstehendes, nach Datum und Uhrzeit aufsteigend", () => {
    const ids = filtere(liste, { zeit: "anstehend" }, HEUTE).map((e) => e.id);
    assert.deepEqual(ids, ["heute", "bald", "spaeter2", "spaeter"]);
  });

  it("zeigt Vergangenes, neueste zuerst, und Alles", () => {
    assert.deepEqual(filtere(liste, { zeit: "vergangen" }, HEUTE).map((e) => e.id), ["alt"]);
    assert.equal(filtere(liste, { zeit: "alle" }, HEUTE).length, 5);
    assert.equal(filtere(liste, { zeit: "alle" }, HEUTE)[0].id, "spaeter");
  });

  it("filtert nach Art und sucht in Titel, Lehrkraft und Ort", () => {
    assert.deepEqual(filtere(liste, { zeit: "alle", art: "vortrag" }, HEUTE).map((e) => e.id), ["spaeter"]);
    assert.deepEqual(filtere(liste, { zeit: "alle", suche: "maier turnhalle" }, HEUTE).map((e) => e.id), ["bald"]);
    assert.deepEqual(filtere(liste, { zeit: "alle", suche: "  VERABSCHIEDUNG " }, HEUTE).map((e) => e.id), ["heute"]);
    assert.deepEqual(filtere(liste, { zeit: "alle", suche: "gibtsnicht" }, HEUTE), []);
  });

  it("gruppiert nach Monat", () => {
    const gruppen = nachMonat(filtere(liste, { zeit: "anstehend" }, HEUTE));
    assert.deepEqual(gruppen.map((g) => [g.monat, g.eintraege.length]), [["2026-11", 2], ["2026-12", 2]]);
  });
});

describe("Gruppieren und Hinweise", () => {
  it("gruppiert Anstehendes nach Wochen, danach nach Monat", () => {
    // HEUTE ist ein Sonntag (15.11.2026): diese Woche reicht bis heute, nächste Woche beginnt am Montag.
    const eintraege = [
      eintrag("a", { datum: "2026-11-15" }),
      eintrag("b", { datum: "2026-11-16" }),
      eintrag("c", { datum: "2026-11-22" }),
      eintrag("d", { datum: "2026-11-23" }),
      eintrag("e", { datum: "2026-12-24" }),
    ];
    const gruppen = gruppiere(eintraege, "anstehend", HEUTE);
    assert.deepEqual(
      gruppen.map((g) => [g.titel, g.eintraege.map((x) => x.id).join("")]),
      [["Diese Woche", "a"], ["Nächste Woche", "bc"], ["November 2026", "d"], ["Dezember 2026", "e"]],
    );
    const alt = gruppiere([eintrag("x", { datum: "2026-10-20" })], "vergangen", HEUTE);
    assert.equal(alt[0].titel, "Oktober 2026");
  });

  it("meldet fehlende Unterlagen nur bei Arten mit festen Unterlagen und nur kurz vorher", () => {
    assert.ok(unterlagenFehlen(eintrag("k", { datum: "2026-11-25", arten: ["konzert"] }), HEUTE));
    assert.ok(!unterlagenFehlen(eintrag("f", { datum: "2026-12-20", arten: ["konzert"] }), HEUTE), "noch zu früh");
    assert.ok(!unterlagenFehlen(eintrag("s", { datum: "2026-11-25", arten: ["sonstiges"] }), HEUTE));
    assert.ok(!unterlagenFehlen(eintrag("v", { datum: "2026-11-01", arten: ["konzert"] }), HEUTE), "vorbei");
    const mitDatei = eintrag("d", { datum: "2026-11-25", arten: ["konzert"] }, { dateienAnzahl: 1 });
    assert.ok(!unterlagenFehlen(mitDatei, HEUTE));
  });

  it("liefert Datumsteile und die Techniker", () => {
    assert.deepEqual(datumTeile("2026-11-23"), { tag: "23", wochentag: "Mo.", monat: "Nov." });
    assert.equal(betreuungNoetig(emptyValues()), null);
    assert.equal(betreuungNoetig({ ...emptyValues(), betreuung_licht: true }), "Licht");
  });
});

describe("Verkleinern für den Browser", () => {
  it("gibt keine privaten Felder an die Liste weiter", () => {
    const voll = {
      id: "x",
      status: "neu" as const,
      values: { ...emptyValues(), titel: "T", email: "geheim@schule.example", anmerkungen: "intern", technische_details: "intern" },
      erstelltAm: "2026-10-01T10:00:00.000Z",
      dateien: [1, 2],
      aenderungen: [{ zeit: "2026-10-02T10:00:00.000Z", felder: ["ort"], von: "Max Muster", notiz: "per Mail", dateienHinzu: ["a.pdf"], dateienWeg: [] }],
    };
    const klein = alsListeneintrag(voll);
    assert.equal(klein.dateienAnzahl, 2);
    const text = JSON.stringify(klein);
    assert.ok(!text.includes("geheim@"));
    assert.ok(!text.includes("intern"));
    assert.ok(!text.includes("Max Muster"), "Namen der Bearbeiter bleiben auf dem Server");
    assert.ok(!text.includes("per Mail"));
    assert.deepEqual(klein.aenderungen, [{ zeit: "2026-10-02T10:00:00.000Z", felder: ["ort"] }]);
    assert.equal(klein.values.titel, "T");
  });
});

describe("Termine und Technik im Detail", () => {
  it("ordnet Termine zeitlich und nimmt die Veranstaltung aus den Hauptfeldern", () => {
    const v = {
      ...emptyValues(),
      datum: "2026-12-04",
      beginn: "18:30",
      ende: "21:00",
      ort: "Aula",
      termine: {
        ...emptyValues().termine,
        probe: { datum: "10. und 12.11.", uhrzeit: "15 Uhr", ort: "Aula" },
        aufbau: { datum: "2026-12-04", uhrzeit: "12:00", ort: "Aula" },
        generalprobe: { datum: "2026-12-03", uhrzeit: "15:00", ort: "" },
        abbau: { datum: "2026-12-05", uhrzeit: "08:00", ort: "Aula" },
      },
    };
    const liste = terminListe(v);
    assert.deepEqual(liste.map((t) => t.label), ["Probe(n)", "Generalprobe", "Aufbau", "Veranstaltung", "Abbau"]);
    assert.equal(liste[0].datum, null);
    assert.equal(liste[0].datumText, "10. und 12.11.");
    assert.equal(liste[3].haupt, true);
    assert.equal(liste[3].uhrzeit, "18:30 bis 21:00 Uhr");
    assert.equal(terminListe(emptyValues()).length, 1, "ohne weitere Termine bleibt nur die Veranstaltung");
  });

  it("trennt Anzahl und Bezeichnung bei der Technik", () => {
    const v = { ...emptyValues(), tech: { mikrofone: true, headsets: true, licht_buehne: true }, mikrofone_anzahl: "8", headsets_anzahl: "" };
    assert.deepEqual(technikGruppen(v), [
      { gruppe: "Ton", punkte: [{ text: "Mikrofone", anzahl: "8" }, { text: "Headsets", anzahl: null }] },
      { gruppe: "Licht", punkte: [{ text: "Bühnenlicht", anzahl: null }] },
    ]);
  });
});

describe("Technik und Betreuung", () => {
  it("fasst Technik für die Liste zusammen", () => {
    const v = { ...emptyValues(), tech: { mikrofone: true, headsets: true, licht_buehne: true, buehne_umbau: true }, mikrofone_anzahl: "6" };
    assert.equal(technikKurz(v), "Ton (6 Mikrofone), Licht, Bühne");
    assert.equal(technikKurz(emptyValues()), "Keine Technik angegeben");
    assert.equal(technikKurz({ ...emptyValues(), tech: { ton_kein: true, licht_raumlicht: true } }), "Keine zusätzliche Technik");
  });

  it("nennt die Betreuung", () => {
    assert.equal(betreuungKurz(emptyValues()), "Ohne Techniker");
    assert.equal(betreuungKurz({ ...emptyValues(), betreuung_ton: true, betreuung_licht: true }), "Techniker nötig: Ton und Licht");
  });
});

describe("Status", () => {
  it("erkennt zu knappe Anmeldungen am Tag der Anmeldung, nicht am heutigen Tag", () => {
    const knapp = eintrag("k", { datum: "2026-11-20", arten: ["konzert"] }, { erstelltAm: "2026-11-01T10:00:00.000Z" });
    assert.deepEqual(knappAngemeldet(knapp), { vorhanden: 19, noetig: 28, art: "Konzert" });
    const rechtzeitig = eintrag("r", { datum: "2026-11-20", arten: ["konzert"] }, { erstelltAm: "2026-09-01T10:00:00.000Z" });
    assert.equal(knappAngemeldet(rechtzeitig), null);
    const absprache = eintrag("a", { datum: "2026-11-20", arten: ["sonstiges"] }, { erstelltAm: "2026-11-19T10:00:00.000Z" });
    assert.equal(knappAngemeldet(absprache), null);
    const angenommen = eintrag("n", { datum: "2026-11-20", arten: ["konzert"] }, { erstelltAm: "2026-11-01T10:00:00.000Z", status: "angenommen" });
    assert.equal(knappAngemeldet(angenommen), null, "nach der Entscheidung ist der Hinweis erledigt");
  });

  it("zeigt nur junge Änderungen", () => {
    const e = eintrag("e", { datum: "2026-12-01" }, { aenderungen: [{ zeit: "2026-11-10T09:00:00.000Z", felder: ["ort"] }] });
    assert.ok(juengsteAenderung(e, HEUTE, 14));
    assert.equal(juengsteAenderung(e, "2026-12-30", 14), null);
    assert.equal(juengsteAenderung(eintrag("x", {}), HEUTE), null);
  });

  it("zählt für die Zusammenfassung nur Anstehendes", () => {
    const s = zusammenfassung(
      [
        eintrag("a", { datum: "2026-11-20", arten: ["konzert"] }, { erstelltAm: "2026-11-01T10:00:00.000Z" }),
        eintrag("b", { datum: "2026-10-01" }),
      ],
      HEUTE,
    );
    assert.deepEqual(s, { anstehend: 1, zuPruefen: 1, rueckfragen: 0, knapp: 1, geaendert: 0, ohneUnterlagen: 1, antwortFehlt: 0 });
  });
});

describe("Beschriftungen und Datum", () => {
  it("benennt Felder auf Deutsch", () => {
    assert.equal(feldBezeichnung("mikrofone_anzahl"), "Anzahl Mikrofone");
    assert.equal(feldBezeichnung("termine.generalprobe"), "Termin Generalprobe");
    assert.equal(feldBezeichnung("unbekannt"), "unbekannt");
  });

  it("rechnet Tage und beschreibt sie", () => {
    assert.equal(tageZwischen("2026-11-15", "2026-11-20"), 5);
    assert.equal(inTagen("2026-11-15", HEUTE), "heute");
    assert.equal(inTagen("2026-11-16", HEUTE), "morgen");
    assert.equal(inTagen("2026-12-04", HEUTE), "in 19 Tagen");
    assert.equal(inTagen("2026-11-12", HEUTE), "vor 3 Tagen");
    assert.match(heuteBerlin(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("Status in der Übersicht", () => {
  const mitStatus = [
    eintrag("a-neu", { datum: "2026-11-20" }),
    eintrag("a-ok", { datum: "2026-11-21" }, { status: "angenommen" }),
    eintrag("a-frage", { datum: "2026-11-22" }, { status: "rueckfrage" }),
    eintrag("a-weg", { datum: "2026-11-23" }, { status: "abgelehnt" }),
  ];

  it("zeigt standardmäßig nur, was im Zeitplan steht", () => {
    assert.deepEqual(filtere(mitStatus, { zeit: "anstehend" }, HEUTE).map((e) => e.id), ["a-neu", "a-ok", "a-frage"]);
  });

  it("filtert nach einzelnen Status und findet Abgelehntes wieder", () => {
    assert.deepEqual(filtere(mitStatus, { zeit: "alle", status: "abgelehnt" }, HEUTE).map((e) => e.id), ["a-weg"]);
    assert.deepEqual(filtere(mitStatus, { zeit: "alle", status: "rueckfrage" }, HEUTE).map((e) => e.id), ["a-frage"]);
    assert.equal(filtere(mitStatus, { zeit: "alle", status: "alle" }, HEUTE).length, 4);
  });

  it("zählt Abgelehntes nicht mit und nennt offene Entscheidungen", () => {
    const z = zusammenfassung(mitStatus, HEUTE);
    assert.equal(z.anstehend, 3);
    assert.equal(z.zuPruefen, 1);
    assert.equal(z.rueckfragen, 1);
  });
});

describe("Besetzung in der Übersicht", () => {
  const kurz = (meine: "dabei" | "nicht_dabei" | "offen") => ({ pflicht: false, benoetigt: null, dabei: 0, nichtDabei: 0, offen: 1, meine });
  const mit = (id: string, meine: "dabei" | "nicht_dabei" | "offen", datum = "2099-05-01", status: Listeneintrag["status"] = "neu") =>
    eintrag(id, { datum }, { besetzung: kurz(meine), status });

  it("filtert nach meinen Einsätzen und nach fehlender Antwort", () => {
    const eintraege = [mit("ja", "dabei"), mit("nein", "nicht_dabei"), mit("offen", "offen"), mit("vorbei", "offen", "2020-01-01")];
    const ids = (einsatz: "alle" | "meine" | "offen") =>
      filtere(eintraege, { zeit: "alle", einsatz }, "2026-11-17").map((e) => e.id).sort();
    assert.deepEqual(ids("alle"), ["ja", "nein", "offen", "vorbei"]);
    assert.deepEqual(ids("meine"), ["ja"]);
    assert.deepEqual(ids("offen"), ["offen"], "Vergangenes zählt nicht als fehlende Antwort");
  });

  it("zählt fehlende Antworten nur bei Anstehendem und nicht bei Abgelehntem", () => {
    const eintraege = [mit("offen", "offen"), mit("abgelehnt", "offen", "2099-05-01", "abgelehnt"), mit("ja", "dabei")];
    assert.equal(zusammenfassung(eintraege, "2026-11-17").antwortFehlt, 1);
    assert.equal(antwortFehlt(mit("x", "offen"), "2026-11-17"), true);
    assert.equal(antwortFehlt(eintrag("y", { datum: "2099-05-01" }), "2026-11-17"), false, "ohne geladene Besetzung gibt es keine Aufforderung");
  });
});
