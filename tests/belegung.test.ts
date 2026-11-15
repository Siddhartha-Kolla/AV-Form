// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alsBelegungsliste, monatsRaster, nachTag, ueberschneidet, verschiebeMonat } from "../lib/belegung.ts";

describe("Belegung", () => {
  it("baut das Monatsraster mit Montag als erstem Tag", () => {
    // Dezember 2026 beginnt an einem Dienstag und hat 31 Tage.
    const raster = monatsRaster(2026, 11);
    assert.equal(raster.length, 5);
    assert.ok(raster.every((w) => w.length === 7));
    assert.equal(raster[0][0], null);
    assert.equal(raster[0][1], "2026-12-01");
    assert.equal(raster[4][3], "2026-12-31");
    assert.equal(raster.flat().filter(Boolean).length, 31);
  });

  it("kommt auch mit Schaltjahr und Monatsanfang am Montag zurecht", () => {
    assert.equal(monatsRaster(2028, 1).flat().filter(Boolean).length, 29);
    assert.equal(monatsRaster(2026, 5)[0][0], "2026-06-01"); // 1. Juni 2026 ist ein Montag
  });

  it("verschiebt Monate über den Jahreswechsel", () => {
    assert.deepEqual(verschiebeMonat(2026, 11, 1), { jahr: 2027, monat: 0 });
    assert.deepEqual(verschiebeMonat(2026, 0, -1), { jahr: 2025, monat: 11 });
  });

  it("gruppiert nach Tag und sortiert nach Beginn", () => {
    const karte = nachTag([
      { datum: "2026-12-04", beginn: "18:00", ende: "20:00" },
      { datum: "2026-12-04", beginn: "08:00", ende: "09:00" },
      { datum: "2026-12-05", beginn: "10:00", ende: "11:00" },
    ]);
    assert.deepEqual(karte.get("2026-12-04")!.map((b) => b.beginn), ["08:00", "18:00"]);
    assert.equal(karte.size, 2);
  });

  it("erkennt Überschneidungen, aneinander grenzende Zeiten nicht", () => {
    const abend = { beginn: "18:00", ende: "20:00" };
    assert.ok(ueberschneidet({ beginn: "19:00", ende: "21:00" }, abend));
    assert.ok(ueberschneidet({ beginn: "17:00", ende: "21:00" }, abend));
    assert.ok(!ueberschneidet({ beginn: "20:00", ende: "21:00" }, abend));
    assert.ok(!ueberschneidet({ beginn: "08:00", ende: "09:00" }, abend));
    assert.ok(!ueberschneidet({ beginn: "", ende: "" }, abend), "ohne Uhrzeit gibt es nichts zu vergleichen");
  });

  it("verwirft Antworten in falscher Form", () => {
    assert.equal(alsBelegungsliste({ datum: "x" }), null);
    assert.deepEqual(alsBelegungsliste([{ datum: "2026-12-04", beginn: "18:00", ende: "20:00", titel: "geheim" }, { datum: "kaputt" }, null]), [
      { datum: "2026-12-04", beginn: "18:00", ende: "20:00" },
    ]);
  });
});
