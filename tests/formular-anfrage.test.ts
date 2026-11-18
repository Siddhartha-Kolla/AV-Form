// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const { aufDieserSeite } = await import("../lib/server/formular-anfrage.ts");

function anfrage(url: string, kopf: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers: kopf });
}

describe("Herkunftsprüfung der Formulare", () => {
  afterEach(() => {
    delete process.env.APP_URL;
    delete process.env.TRUST_PROXY;
  });

  it("lässt Anfragen ohne Herkunft und von der eigenen Adresse zu", () => {
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/anmeldung/senden", {})), true);
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/anmeldung/senden", { origin: "http://localhost:3000" })), true);
  });

  it("weist fremde und unlesbare Herkunft ab", () => {
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", { origin: "https://boese.example" })), false);
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", { origin: "null" })), false);
  });

  it("erkennt hinter einem Proxy die öffentliche Adresse über APP_URL", () => {
    const hinterProxy = { origin: "https://technik.schule.example" };
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", hinterProxy)), false, "ohne APP_URL unbekannt");
    process.env.APP_URL = "https://technik.schule.example/";
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", hinterProxy)), true);
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", { origin: "https://boese.example" })), false);
  });

  it("glaubt dem X-Forwarded-Host nur, wenn dem Proxy vertraut wird", () => {
    const kopf = { origin: "https://technik.schule.example", "x-forwarded-host": "technik.schule.example" };
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", kopf)), false);
    process.env.TRUST_PROXY = "1";
    assert.equal(aufDieserSeite(anfrage("http://localhost:3000/x", kopf)), true);
  });
});
