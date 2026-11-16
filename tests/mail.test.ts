// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { sendeMail } = await import("../lib/server/mail.ts");
const { smtpEinstellungen, teamAdressen, appUrl } = await import("../lib/server/config.ts");

const mail = { an: "a@schule.example", betreff: "Test", text: "Hallo" };

describe("E-Mail", () => {
  it("sagt im Betrieb ehrlich, dass nichts verschickt wurde, wenn kein SMTP-Server eingetragen ist", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.MAIL_IN_TERMINAL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    assert.equal(await sendeMail(mail), "nicht_konfiguriert");
  });

  it("meldet einen fehlgeschlagenen Versand, ohne zu werfen", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1"; // dort lauscht nichts
    process.env.MAIL_FROM = "Technikteam <technik@schule.example>";
    const stumm = console.error;
    console.error = () => {};
    try {
      assert.equal(await sendeMail(mail), "fehlgeschlagen");
    } finally {
      console.error = stumm;
    }
  });

  it("liest die Einstellungen sauber", () => {
    process.env.SMTP_PORT = "465";
    assert.equal(smtpEinstellungen()?.secure, true);
    process.env.SMTP_PORT = "587";
    assert.equal(smtpEinstellungen()?.secure, false);
    // Schreibweisen von SMTP_SECURE: "true" wurde früher als "aus" gelesen, und Port 465 hing dann.
    process.env.SMTP_PORT = "465";
    for (const an of ["true", "1", "Ja", " ON "]) {
      process.env.SMTP_SECURE = an;
      assert.equal(smtpEinstellungen()?.secure, true, an);
    }
    process.env.SMTP_SECURE = "false";
    assert.equal(smtpEinstellungen()?.secure, false);
    process.env.SMTP_SECURE = "unverständlich";
    assert.equal(smtpEinstellungen()?.secure, true, "unverständliche Werte fallen auf die Vorgabe des Ports zurück");
    delete process.env.SMTP_SECURE;
    process.env.SMTP_PORT = "587";
    delete process.env.SMTP_HOST;
    assert.equal(smtpEinstellungen(), null);

    process.env.TEAM_BENACHRICHTIGUNG = "a@schule.example, kaputt, b@schule.example";
    assert.deepEqual(teamAdressen(), ["a@schule.example", "b@schule.example"]);

    process.env.APP_URL = "https://technik.schule.example/";
    assert.equal(appUrl(), "https://technik.schule.example");
    delete process.env.APP_URL;
    assert.equal(appUrl(), null, "im Betrieb ohne APP_URL gibt es keine Links");
  });
});
