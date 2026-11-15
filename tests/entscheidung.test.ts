// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { istEntscheidung, istStatus, mailAnLehrkraft, pruefeEntscheidung } from "../lib/entscheidung.ts";

describe("Entscheidung", () => {
  it("kennt nur die vier Status und drei Entscheidungen", () => {
    assert.ok(istStatus("neu") && istStatus("abgelehnt"));
    assert.ok(!istStatus("kaputt") && !istStatus(null));
    assert.ok(istEntscheidung("rueckfrage"));
    assert.ok(!istEntscheidung("neu"), "Zu prüfen setzt nur die Lehrkraft durch eine Änderung");
  });

  it("verlangt nur bei der Rückfrage eine Nachricht", () => {
    assert.equal(pruefeEntscheidung("angenommen", ""), null);
    assert.equal(pruefeEntscheidung("abgelehnt", ""), null);
    assert.ok(pruefeEntscheidung("rueckfrage", " "));
    assert.equal(pruefeEntscheidung("rueckfrage", "Was ist mit dem Ablaufplan?"), null);
    assert.ok(pruefeEntscheidung("angenommen", "x".repeat(1001)));
  });

  it("bereitet eine E-Mail in Sie-Form vor", () => {
    const link = mailAnLehrkraft({
      email: "frau.test@schule.example",
      lehrkraft: "Frau Test",
      titel: "Sommerkonzert",
      status: "rueckfrage",
      nachricht: "Bitte den Ablaufplan nachreichen & Mikrofone prüfen.",
      absender: "Max",
    });
    assert.ok(link.startsWith("mailto:frau.test@schule.example?"));
    const parameter = new URL(link).searchParams;
    assert.equal(parameter.get("subject"), "Ihre Anmeldung „Sommerkonzert“: Rückfrage");
    const text = parameter.get("body")!;
    assert.ok(text.includes("Guten Tag Frau Test,"));
    assert.ok(text.includes("Bitte den Ablaufplan nachreichen & Mikrofone prüfen."));
    assert.ok(text.includes("Max") && text.includes("Technikteam"));
  });
});
