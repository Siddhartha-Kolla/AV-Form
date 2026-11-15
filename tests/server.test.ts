// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "technik-test-"));
const schluesselA = `1:${randomBytes(32).toString("base64")}`;
process.env.DATA_DIR = dir;
process.env.APP_ENCRYPTION_KEYS = schluesselA;
process.env.RETENTION_MONTHS = "6";

const { emptyValues } = await import("../lib/registration.ts");
const crypto = await import("../lib/server/crypto.ts");
const { db, dbSchliessen } = await import("../lib/server/db.ts");
const anm = await import("../lib/server/anmeldungen.ts");
const dat = await import("../lib/server/dateien.ts");

function beispiel(extra: Partial<ReturnType<typeof emptyValues>> = {}) {
  return {
    ...emptyValues(),
    titel: "Geheimes Sommerkonzert",
    lehrkraft: "Hartmann-Testname",
    email: "Hartmann.Test@schule.example",
    datum: "2099-06-17",
    beginn: "18:30",
    ende: "21:00",
    ort: "Aula",
    arten: ["konzert" as const],
    ...extra,
  };
}

after(() => {
  dbSchliessen();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Verschlüsselung", () => {
  it("entschlüsselt, was verschlüsselt wurde", () => {
    const blob = crypto.verschluesseln("Grüße", "test:1");
    assert.equal(crypto.entschluesseln(blob, "test:1").toString("utf8"), "Grüße");
  });

  it("erkennt manipulierte Daten und falsche Zuordnung", () => {
    const blob = crypto.verschluesseln("Inhalt", "test:1");
    const kaputt = Buffer.from(blob);
    kaputt[kaputt.length - 20] ^= 1;
    assert.throws(() => crypto.entschluesseln(kaputt, "test:1"));
    assert.throws(() => crypto.entschluesseln(blob, "test:2"));
  });

  it("verschlüsselt denselben Text jedes Mal anders", () => {
    assert.notDeepEqual(crypto.verschluesseln("gleich", "a"), crypto.verschluesseln("gleich", "a"));
  });
});

describe("Anmeldungen", () => {
  it("legt an und findet sie nur mit dem richtigen Token", () => {
    const { id, token } = anm.erstelleAnmeldung(beispiel());
    assert.equal(anm.findeNachToken(token)?.id, id);
    assert.equal(anm.findeNachToken(token)?.values.lehrkraft, "Hartmann-Testname");
    assert.equal(anm.findeNachToken(crypto.neuesToken()), null);
    assert.equal(anm.findeNachToken("zu-kurz"), null);
    assert.equal(anm.findeNachToken("' OR 1=1 --"), null);
  });

  it("speichert keinen Klartext in der Datenbankdatei", () => {
    const { token } = anm.erstelleAnmeldung(beispiel());
    db().pragma("wal_checkpoint(TRUNCATE)");
    const inhalt = fs.readFileSync(path.join(dir, "technik.db")).toString("latin1");
    const wal = fs.existsSync(path.join(dir, "technik.db-wal"))
      ? fs.readFileSync(path.join(dir, "technik.db-wal")).toString("latin1")
      : "";
    for (const geheim of ["Hartmann-Testname", "Geheimes Sommerkonzert", "schule.example", "Aula", token]) {
      assert.ok(!inhalt.includes(geheim), `${geheim} steht im Klartext in der Datenbank`);
      assert.ok(!wal.includes(geheim), `${geheim} steht im Klartext im WAL`);
    }
  });

  it("verweigert vertauschte verschlüsselte Daten", () => {
    const a = anm.erstelleAnmeldung(beispiel({ titel: "A" }));
    const b = anm.erstelleAnmeldung(beispiel({ titel: "B" }));
    const daten = db().prepare("SELECT daten FROM anmeldungen WHERE id = ?").get(a.id) as { daten: Buffer };
    db().prepare("UPDATE anmeldungen SET daten = ? WHERE id = ?").run(daten.daten, b.id);
    assert.throws(() => anm.findeNachId(b.id));
    const liste = anm.listeAnmeldungen();
    assert.ok(liste.unlesbar.includes(b.id));
    assert.ok(liste.anmeldungen.some((x) => x.id === a.id));
  });

  it("vermerkt Änderungen und zählt die Revision hoch", () => {
    const { id } = anm.erstelleAnmeldung(beispiel());
    const original = anm.findeNachId(id)!;
    assert.deepEqual(anm.aktualisiereAnmeldung(id, original.values), { geaendert: [] });

    const neu = { ...original.values, ort: "Turnhalle", termine: { ...original.values.termine } };
    neu.termine.probe = { datum: "10.06.", uhrzeit: "15 Uhr", ort: "" };
    const ergebnis = anm.aktualisiereAnmeldung(id, neu);
    assert.deepEqual(ergebnis?.geaendert.sort(), ["ort", "termine.probe"]);

    const danach = anm.listeAnmeldungen().anmeldungen.find((x) => x.id === id)!;
    assert.equal(danach.revision, 2);
    assert.equal(danach.values.ort, "Turnhalle");
    assert.equal(danach.aenderungen.length, 1);
  });

  it("vergibt bei verlorenem Link ein neues Token und entwertet das alte", () => {
    const { token } = anm.erstelleAnmeldung(beispiel({ email: "link.verloren@schule.example", datum: "2099-01-01" }));
    const neu = anm.neueZugangslinks("  LINK.verloren@Schule.example ", "2026-01-01");
    assert.equal(neu.length, 1);
    assert.equal(anm.findeNachToken(token), null);
    assert.ok(anm.findeNachToken(neu[0].token));
    assert.deepEqual(anm.neueZugangslinks("unbekannt@schule.example", "2026-01-01"), []);
  });

  it("liest Zeilen auch nach einem Schlüsselwechsel", () => {
    const { token } = anm.erstelleAnmeldung(beispiel({ email: "rotation@schule.example" }));
    process.env.APP_ENCRYPTION_KEYS = `2:${randomBytes(32).toString("base64")},${schluesselA}`;
    crypto.schluesselNeuLaden();
    try {
      assert.equal(anm.findeNachToken(token)?.values.email, "rotation@schule.example");
      assert.equal(anm.neueZugangslinks("rotation@schule.example", "2026-01-01").length, 1);
      const neu = anm.erstelleAnmeldung(beispiel({ email: "neu@schule.example" }));
      assert.equal(anm.findeNachId(neu.id)?.values.email, "neu@schule.example");
    } finally {
      process.env.APP_ENCRYPTION_KEYS = schluesselA;
      crypto.schluesselNeuLaden();
    }
  });
});

describe("Dateien", () => {
  it("speichert verschlüsselt und gibt nur der richtigen Anmeldung Zugriff", () => {
    const a = anm.erstelleAnmeldung(beispiel());
    const b = anm.erstelleAnmeldung(beispiel());
    const inhalt = Buffer.from("Streng geheimer Ablaufplan");
    const info = dat.speichereDatei(a.id, "Ablaufplan Sommerkonzert.pdf", inhalt);

    const roh = fs.readFileSync(path.join(dir, "dateien", `${info.id}.bin`));
    assert.ok(!roh.includes("Streng geheimer"));
    const zeile = db().prepare("SELECT name FROM dateien WHERE id = ?").get(info.id) as { name: Buffer };
    assert.ok(!zeile.name.includes("Ablaufplan"));

    assert.deepEqual(dat.leseDatei(a.id, info.id)?.inhalt, inhalt);
    assert.equal(dat.leseDatei(a.id, info.id)?.info.name, "Ablaufplan Sommerkonzert.pdf");
    assert.equal(dat.leseDatei(b.id, info.id), null);
    assert.equal(dat.leseDatei(a.id, "../../etc/passwd"), null);
    assert.equal(dat.listeDateien(a.id).length, 1);
  });

  it("lehnt falsche Typen, leere Dateien und Pfadtricks ab", () => {
    const { id } = anm.erstelleAnmeldung(beispiel());
    assert.throws(() => dat.speichereDatei(id, "virus.exe", Buffer.from("x")));
    assert.throws(() => dat.speichereDatei(id, "leer.pdf", Buffer.alloc(0)));
    const info = dat.speichereDatei(id, "..\\..\\boese/plan.pdf", Buffer.from("x"));
    assert.equal(info.name, "plan.pdf");
  });
});

describe("Aufbewahrung", () => {
  it("löscht abgelaufene Anmeldungen samt Dateien und lässt aktuelle stehen", () => {
    const alt = anm.erstelleAnmeldung(beispiel({ datum: "2024-01-10" }));
    const aktuell = anm.erstelleAnmeldung(beispiel({ datum: "2099-01-10" }));
    const datei = dat.speichereDatei(alt.id, "alt.pdf", Buffer.from("alt"));
    const pfad = path.join(dir, "dateien", `${datei.id}.bin`);
    assert.ok(fs.existsSync(pfad));

    const geloescht = anm.loescheAbgelaufene(new Date(2026, 0, 1));
    assert.ok(geloescht >= 1);
    assert.equal(anm.findeNachId(alt.id), null);
    assert.ok(anm.findeNachId(aktuell.id));
    assert.ok(!fs.existsSync(pfad));
    assert.equal((db().prepare("SELECT COUNT(*) n FROM dateien WHERE id = ?").get(datei.id) as { n: number }).n, 0);
  });
});
