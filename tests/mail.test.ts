// Aufruf: npm run test:server
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { sendeMail } = await import("../lib/server/mail.ts");
const { smtpEinstellungen, teamAdressen, appUrl } = await import("../lib/server/config.ts");
const vorlagen = await import("../lib/mail-vorlagen.ts");

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

describe("Mailvorlagen", () => {
  const termin = { titel: "Elternabend", datum: "2099-05-04", beginn: "19:00", ende: "21:00", ort: "Mensa" };

  it("nennen in jeder Entscheidung Titel, Termin und die Nachricht des Teams", () => {
    for (const status of ["angenommen", "rueckfrage", "abgelehnt"] as const) {
      const m = vorlagen.mailEntscheidung({ lehrkraft: "Frau Test", termin, status, nachricht: "Bitte den Ablauf senden.", absender: "Mia" });
      for (const teil of ["Elternabend", "19:00", "Mensa", "Bitte den Ablauf senden.", "Frau Test"]) {
        assert.ok(m.text.includes(teil), `${status} Text: ${teil}`);
        assert.ok(m.html.includes(teil), `${status} HTML: ${teil}`);
      }
      assert.ok(m.betreff.includes("Elternabend"));
    }
    const ohne = vorlagen.mailEntscheidung({ lehrkraft: "F", termin, status: "angenommen", nachricht: null, absender: null });
    assert.ok(!ohne.text.includes("Nachricht vom Technikteam"));
    assert.ok(!ohne.html.includes("Nachricht vom Technikteam"));
  });

  it("maskieren Eingaben, damit nichts als HTML wirkt", () => {
    const boese = '<img src=x onerror="alert(1)">';
    const m = vorlagen.mailEntscheidung({
      lehrkraft: boese,
      termin: { ...termin, titel: boese, ort: boese },
      status: "rueckfrage",
      nachricht: `${boese}
zweite Zeile`,
      absender: boese,
    });
    assert.ok(!m.html.includes("<img"));
    assert.ok(m.html.includes("&lt;img"));
    assert.ok(m.html.includes("zweite Zeile"));
    const neu = vorlagen.mailEingang({ lehrkraft: boese, termin, link: 'https://x.example/anmeldung/a"b' });
    assert.ok(!neu.html.includes('a"b'));
  });

  it("enthalten den privaten Link nur in der Bestätigung, nicht in der Entscheidung", () => {
    const link = "https://technik.example/anmeldung/abc";
    const eingang = vorlagen.mailEingang({ lehrkraft: "F", termin, link });
    assert.ok(eingang.text.includes(link) && eingang.html.includes(link));
    const e = vorlagen.mailEntscheidung({ lehrkraft: "F", termin, status: "angenommen", nachricht: null, absender: null });
    assert.ok(!e.text.includes("/anmeldung/") && !e.html.includes("/anmeldung/"));
  });

  it("verbinden das Team mit der Anmeldung", () => {
    const link = "https://technik.example/team/anmeldungen/1";
    for (const m of [vorlagen.mailTeamNeu({ lehrkraft: "F", termin, link }), vorlagen.mailTeamGeaendert({ lehrkraft: "F", termin, link })]) {
      assert.ok(m.text.includes(link) && m.html.includes(link));
    }
  });
});
