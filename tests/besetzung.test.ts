// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  besetzungGesperrt,
  besetzungText,
  fehlend,
  MAX_NOTIZ,
  pruefeAntwort,
  pruefeBenoetigt,
  zaehle,
} from "../lib/besetzung.ts";

describe("Besetzung: Regeln", () => {
  it("prüft Antworten, bei einer Pflicht braucht ein Nein eine Begründung", () => {
    assert.equal(pruefeAntwort("dabei", "", false), null);
    assert.equal(pruefeAntwort("dabei", "", true), null);
    assert.equal(pruefeAntwort("nicht_dabei", "", false), null);
    assert.match(pruefeAntwort("nicht_dabei", "  ", true) ?? "", /warum/);
    assert.equal(pruefeAntwort("nicht_dabei", "Klausur", true), null);
    assert.ok(pruefeAntwort("vielleicht", "", false));
    assert.ok(pruefeAntwort("dabei", "x".repeat(MAX_NOTIZ + 1), false));
  });

  it("prüft die Zahl der benötigten Leute", () => {
    assert.deepEqual(pruefeBenoetigt(""), { ok: true, benoetigt: null });
    assert.deepEqual(pruefeBenoetigt(null), { ok: true, benoetigt: null });
    assert.deepEqual(pruefeBenoetigt("4"), { ok: true, benoetigt: 4 });
    for (const schlecht of [0, -1, 51, 2.5, "abc", NaN]) assert.equal(pruefeBenoetigt(schlecht).ok, false, String(schlecht));
  });

  it("zählt und beschreibt den Stand", () => {
    const z = zaehle([{ antwort: "dabei" }, { antwort: "dabei" }, { antwort: "nicht_dabei" }, { antwort: "offen" }]);
    assert.deepEqual(z, { dabei: 2, nichtDabei: 1, offen: 1 });
    assert.equal(besetzungText({ dabei: 2, benoetigt: 4 }), "2 von 4 dabei");
    assert.equal(besetzungText({ dabei: 2, benoetigt: null }), "2 dabei");
    assert.equal(besetzungText({ dabei: 0, benoetigt: null }), "Noch niemand dabei");
    assert.equal(fehlend({ dabei: 2, benoetigt: 4 }), 2);
    assert.equal(fehlend({ dabei: 5, benoetigt: 4 }), 0);
    assert.equal(fehlend({ dabei: 0, benoetigt: null }), 0);
  });

  it("sperrt abgelehnte und vergangene Veranstaltungen", () => {
    assert.ok(besetzungGesperrt("abgelehnt", "2099-01-01", "2026-11-17"));
    assert.ok(besetzungGesperrt("angenommen", "2026-11-16", "2026-11-17"));
    assert.equal(besetzungGesperrt("neu", "2026-11-17", "2026-11-17"), null, "am Tag selbst ist noch alles offen");
    assert.equal(besetzungGesperrt("rueckfrage", "2099-01-01", "2026-11-17"), null);
  });
});
