# Technikteam: Veranstaltungsanmeldung

Lehrkräfte melden Veranstaltungen beim Technikteam an, mit Termin, benötigter Technik und Unterlagen. Das Team prüft, nimmt an, stellt Rückfragen oder lehnt ab. Alles läuft in einer einzigen Next.js-Anwendung auf einem eigenen Server. Die Daten liegen in einer SQLite-Datei und einem Ordner, es gibt keinen externen Dienst außer dem Mailserver der Schule.

Diese Datei hat zwei Teile: zuerst **Einrichten auf einem Server**, dann **Wie es funktioniert**.

---

## 1. Einrichten auf einem Server

### Was du brauchst

- Einen Server mit **Node.js 20.9 oder neuer** (getestet mit 22). Linux ist der Normalfall.
- **HTTPS** mit einer eigenen Domain, zum Beispiel `technik.deine-schule.de`. Ohne HTTPS funktioniert die Anmeldung im Teambereich nicht, weil das Sitzungs-Cookie nur über HTTPS gesetzt wird.
- Einen Reverse Proxy (Caddy oder nginx), der HTTPS annimmt und an die App weiterreicht.
- Zugangsdaten eines SMTP-Servers der Schule für die E-Mails.
- Einen Ordner für die Daten, **außerhalb** des Projektordners, zum Beispiel `/var/lib/technik`.

Die Datenbank (`better-sqlite3`) ist ein natives Modul. Auf gängigen Systemen kommt sie fertig gebaut mit `npm ci`. Fehlt für deine Node-Version ein fertiges Paket, baut npm sie selbst. Das braucht Compiler-Werkzeuge, sonst bricht `npm ci` mit `not found: make` ab. Unter Debian oder Ubuntu:

```bash
sudo apt update && sudo apt install -y build-essential python3
```

### Schritte

```bash
# 1. Code holen und Pakete installieren
git clone <adresse-des-repos> technik-form
cd technik-form
npm ci

# 2. Hauptschlüssel erzeugen (die ganze Zeile in die .env.local übernehmen)
npm run keygen

# 3. Einstellungen anlegen
cp .env.example .env.local
#    dann .env.local ausfüllen, siehe Tabelle unten

# 4. Bauen und starten
npm run build
npm start -- -p 3000        # lauscht auf Port 3000

# 5. Den ersten Superuser anlegen (das Startpasswort erscheint nur hier)
npm run team -- superuser deinname "Dein Name"
```

Beim ersten Login wählst du ein eigenes Passwort. Danach legst du unter **Mitglieder** weitere Konten an.

Die Einstellungen stehen in `.env.local`. Next.js liest sie beim Start, und die Hilfsbefehle (`npm run team`, `db:cleanup`, `smtp:pruefen`) lesen dieselbe Datei. Auf dem Server reicht deshalb diese eine Datei.

### Einstellungen

| Variable | Bedeutung |
|---|---|
| `APP_ENCRYPTION_KEYS` | Hauptschlüssel, erzeugt mit `npm run keygen`. **Pflicht.** |
| `DATA_DIR` | Ordner für Datenbank und hochgeladene Dateien, zum Beispiel `/var/lib/technik`. |
| `APP_URL` | Öffentliche Adresse ohne Schrägstrich am Ende. Links in Mails beginnen damit. Ohne sie gehen im Betrieb **keine Mails** raus. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Der Mailserver der Schule. Prüfen mit `npm run smtp:pruefen`. |
| `MAIL_FROM` | Absender, zum Beispiel `Technikteam <technik@deine-schule.de>`. Lehrkräfte antworten dorthin, also ein Postfach, das jemand liest. |
| `TEAM_BENACHRICHTIGUNG` | Adressen, die bei jeder neuen Anmeldung eine Mail bekommen, durch Komma getrennt. |
| `TRUST_PROXY` | Auf `1` setzen, wenn ein Reverse Proxy davor steht, der `X-Forwarded-For` setzt. Erst damit gibt es IP-Adressen im Protokoll und die Bremse je IP. |
| `RETENTION_MONTHS` | Anmeldungen werden so viele Monate nach der Veranstaltung gelöscht (Standard 6). |
| `PROTOKOLL_AUFBEWAHRUNG_TAGE` | So lange bleibt das Protokoll (Standard 180). |
| `AUTH_ANBIETER` | Anmeldemethoden, Standard `passwort`. |

Passwörter mit Sonderzeichen in `.env.local` in Anführungszeichen setzen.

### Dauerbetrieb

**Prozess am Laufen halten.** Zum Beispiel mit systemd (`/etc/systemd/system/technik.service`):

```ini
[Unit]
Description=Technikteam Anmeldung
After=network.target

[Service]
WorkingDirectory=/opt/technik-form
ExecStart=/usr/bin/npm start -- -p 3000
Restart=always
User=technik

[Install]
WantedBy=multi-user.target
```

Starte genau **einen** Prozess. Die Datenbank ist eine Datei, und einige Dinge (Bremse, kurzer Zwischenspeicher für den Kalender) leben im Arbeitsspeicher des Prozesses. Mehrere Instanzen nebeneinander sind nicht vorgesehen.

**HTTPS davor.** Mit Caddy genügt:

```
technik.deine-schule.de {
    reverse_proxy localhost:3000
    request_body { max_size 250MB }
}
```

Bei nginx `client_max_body_size 250m;` setzen. Hochgeladene Dateien dürfen bis zu 20 MB groß sein, ein Formular bis zu 10 Dateien.

**Täglich aufräumen.** Ein Cron-Eintrag löscht abgelaufene Anmeldungen samt Dateien, alte Sitzungen, Fehlversuche und altes Protokoll:

```
15 3 * * *  cd /opt/technik-form && npm run db:cleanup
```

**Sichern.** Sichere den Ordner `DATA_DIR` (`technik.db` mit den Dateien `technik.db-wal` und `technik.db-shm` sowie den Unterordner `dateien/`). Am saubersten ist es, die App kurz anzuhalten oder `sqlite3 technik.db ".backup sicherung.db"` zu benutzen. **Den Schlüssel `APP_ENCRYPTION_KEYS` sicherst du getrennt davon**, zum Beispiel in einem Passwortmanager. Ohne den Schlüssel sind die gesicherten Daten unlesbar, und mit der Sicherung allein kommt niemand an die Inhalte.

### Aktualisieren

```bash
git pull
npm ci
npm run build
sudo systemctl restart technik
```

Änderungen am Datenbankaufbau werden beim Start selbst eingespielt. Die Datenbank hat eine Versionsnummer, und fehlende Schritte laufen der Reihe nach.

### Wenn etwas schiefgeht

| Problem | Was hilft |
|---|---|
| Passwort vergessen (auch das des Superusers) | `npm run team -- passwort-reset <benutzername>` gibt ein neues Startpasswort aus. Alle Sitzungen des Kontos enden. |
| Wer hat welches Konto? | `npm run team -- liste` |
| Mails kommen nicht an | `npm run smtp:pruefen` testet Verbindung und Login. Im Teambereich zeigt das **Protokoll** den Grund, zum Beispiel die Antwort des Mailservers. Die Anmeldung selbst bleibt immer gespeichert. |
| Seite meldet einen Fehler zu Schlüsseln | `APP_ENCRYPTION_KEYS` fehlt oder hat das falsche Format. Neu erzeugen geht nur für eine neue, leere Datenbank. |

---

## 2. Wie es funktioniert

### Überblick

```
Lehrkraft (Browser)                       Team (Browser)
   │  Formular unter /                       │  /team (mit Anmeldung)
   ▼                                         ▼
┌──────────────────── Next.js-Anwendung (ein Prozess) ───────────────────┐
│  Seiten und Routen  →  Serverlogik (lib/server)  →  Verschlüsselung    │
└──────────────┬─────────────────────────────────────────┬───────────────┘
               ▼                                         ▼
     SQLite-Datei (technik.db)               SMTP-Server der Schule
     + Ordner dateien/ (verschlüsselt)       (nur ausgehende Mails)
```

Es gibt keine Cloud und keinen Fremddienst. Die Anwendung ist reines Next.js mit Server-Komponenten. Alles, was Daten liest oder schreibt, läuft auf dem Server, im Browser landet nur das Ergebnis.

### Der Weg einer Anmeldung

1. **Formular.** Die Lehrkraft füllt unter `/` das Formular aus. Rechts (auf dem Handy aufklappbar) sieht sie, welche Termine das Team schon hat. Das liefert `/belegung`, **nur mit Datum und Uhrzeit**, ohne Titel und Namen.
2. **Absenden.** Der Browser schickt alles an `/anmeldung/senden`. Der Server prüft **alles noch einmal**: Pflichtfelder, Datum nicht in der Vergangenheit, Dateityp und Größe. Was der Browser vorab prüft, ist nur Komfort.
3. **Schutz vor Missbrauch.** Das Formular ist öffentlich und braucht deshalb Schutz, ohne die Lehrkräfte zu nerven:
   - ein verstecktes Feld, das nur Programme ausfüllen,
   - eine Mindestdauer von 4 Sekunden zwischen Öffnen und Absenden,
   - eine Bremse: höchstens 6 Anmeldungen je IP-Adresse und 40 insgesamt in 15 Minuten.

   Programme, die in die Falle laufen, bekommen eine Erfolgsmeldung, aber nichts wird gespeichert.
4. **Speichern.** Die Angaben landen verschlüsselt in der Datenbank, die Dateien verschlüsselt im Ordner `dateien/`. Bei einem Fehler mitten im Speichern wird nichts halb angelegt.
5. **Bestätigungsmail.** Die Lehrkraft bekommt eine Mail mit ihrem **privaten Link**. Das Team bekommt eine Benachrichtigung, falls `TEAM_BENACHRICHTIGUNG` gesetzt ist.

### Der private Link der Lehrkraft

Lehrkräfte haben **kein Konto und kein Passwort**. Ihr Zugang ist ein Link der Form `/anmeldung/<token>`.

- Das Token ist eine zufällige 256-Bit-Zahl. Gespeichert wird **nur ihr Hash**. Wer die Datenbank liest, kann daraus keinen Link bauen.
- Mit dem Link sieht die Lehrkraft den Stand, die Nachricht des Teams, ändert Angaben und reicht Unterlagen nach. Abgelehnte und vergangene Veranstaltungen lassen sich nicht mehr ändern.
- Die Seiten mit dem Token sind für Suchmaschinen gesperrt und geben die Adresse nicht an andere Seiten weiter.
- Weil nur der Hash gespeichert ist, **steht der Link nur in der ersten Mail**. Spätere Mails (Entscheidung, Rückfrage) verweisen darauf.

### Das Team: Konten, Rollen, Entscheidung

| Rolle | Darf |
|---|---|
| **Superuser** (genau einer, nur per Kommandozeile anlegbar) | alles, auch das Protokoll lesen und Admins verwalten |
| **Admin** | alles mit Anmeldungen (auch löschen), Mitglieder verwalten, **kein Protokoll** |
| **Mitglied** | Anmeldungen ansehen, bearbeiten, entscheiden |

Wer ein Konto verwaltet, braucht einen höheren Rang als das Konto. Ein Admin legt also Mitglieder an, aber keine Admins, und niemand erhöht sich selbst.

**Anmelden.** Mit Benutzername und Passwort. Passwörter werden mit scrypt gehasht, falsche Versuche werden je Benutzername und je IP gebremst. Vergibt jemand ein Startpasswort, muss die Person es beim ersten Login ändern. Eine Sitzung endet nach 8 Stunden ohne Aktivität und spätestens nach 7 Tagen. Gesperrte oder gelöschte Konten verlieren ihre Sitzungen sofort.

**Anmeldeanbieter.** Das Passwort ist ein Anbieter von mehreren möglichen. `AUTH_ANBIETER` und `lib/server/auth/anbieter.ts` sind der Platz, um später etwa Schul-Login einzubauen, ohne den Rest umzubauen.

**Status einer Anmeldung.**

| Status | Bedeutung |
|---|---|
| Zu prüfen | eingegangen, noch nicht entschieden |
| Angenommen | steht im Zeitplan |
| Rückfrage offen | das Team wartet auf die Lehrkraft |
| Abgelehnt | nicht im Zeitplan, verschwindet aus der Übersicht, bleibt unter dem Filter „Abgelehnt“ auffindbar |

Bei jeder Entscheidung kann das Team eine Nachricht schreiben. Die Lehrkraft bekommt sie **per Mail** und sieht sie auf ihrer Seite. Ändert die Lehrkraft etwas an einer angenommenen oder rückgefragten Anmeldung, springt sie auf „Zu prüfen“ zurück, und das Team bekommt eine Mail. Zwei Teammitglieder, die gleichzeitig entscheiden, überschreiben sich nicht: Der zweite bekommt den Hinweis, die Seite neu zu laden.

### Verschlüsselung und Datenschutz

- **Was im Klartext liegt:** nur das Veranstaltungsdatum (zum Sortieren und Aufräumen) und technische Schlüssel wie IDs und Zeitstempel.
- **Was verschlüsselt ist:** Titel, Namen, E-Mail-Adressen, alle Angaben, Dateinamen, Dateiinhalte, Entscheidungs-Nachrichten, Profilbilder, Geräteangaben und die Einzelheiten im Protokoll. Verwendet wird AES-256-GCM im Anwendungscode.
- **Schlüssel.** Aus dem Hauptschlüssel werden zwei getrennte Schlüssel abgeleitet, einer für die Verschlüsselung und einer für den E-Mail-Hash (so findet die App Anmeldungen zu einer Adresse, ohne sie zu speichern). Jeder verschlüsselte Wert ist an Zweck und ID gebunden: Ein aus einer anderen Zeile kopierter Wert lässt sich nicht öffnen.
- **Schlüsselwechsel.** In `APP_ENCRYPTION_KEYS` stehen mehrere Schlüssel, durch Komma getrennt (`1:...,2:...`). Der erste ist der aktuelle, die anderen dienen nur noch zum Lesen alter Daten.
- **Keine Fremdanbieter.** Kein Tracking, keine externen Skripte, keine Schriften von außen. Das Einzige, was den Server verlässt, sind die Mails über den SMTP-Server der Schule.
- **Aufbewahrung.** `npm run db:cleanup` löscht Anmeldungen samt Dateien 6 Monate nach dem Veranstaltungstermin (einstellbar). Gelöschte Inhalte werden in der Datenbank überschrieben.

### Das Protokoll

Der Superuser sieht unter **Protokoll**, wer wann was getan hat: Anmeldungen, Entscheidungen, Änderungen durch Lehrkräfte, Kontoänderungen, Passwortwechsel, Datei-Downloads, fehlgeschlagene Mails. Es steht **nie** ein Passwort, Token oder Dateiinhalt darin. Namen bleiben auch dann erhalten, wenn ein Konto später gelöscht wird. Nach 180 Tagen (einstellbar) wird es aufgeräumt. Zu Datenschutzfragen gehört das mit dem Datenschutzbeauftragten der Schule abgestimmt.

### Mails

Versendet werden die Mails von `lib/server/mail.ts` über den SMTP-Server der Schule. Die Texte stehen in `lib/mail-vorlagen.ts`: schlichtes HTML, dazu immer eine Textfassung. Ein Fehler beim Versand **wirft nie** und macht nie eine Anmeldung rückgängig. Er steht im Protokoll, und das Team sieht im Dialog, wenn die Mail nicht rausging.

In der Entwicklung (ohne `SMTP_HOST`) erscheinen die Mails samt Links im Terminal.

### Wo was im Code liegt

| Ordner | Inhalt |
|---|---|
| `app/page.tsx`, `components/registration-form.tsx` | das öffentliche Formular |
| `app/anmeldung/` | Senden, privater Link der Lehrkraft, Änderungen |
| `app/team/` | der Teambereich: Übersicht, Detailseite, Mitglieder, Protokoll, Mein Konto |
| `app/belegung/` | der öffentliche Kalender (nur Datum und Uhrzeit) |
| `lib/` | Regeln, die Browser und Server gemeinsam brauchen (Prüfungen, Status, Rollen, Mail-Vorlagen) |
| `lib/server/` | alles, was Datenbank, Dateien, Schlüssel und Mails anfasst. Nur auf dem Server |
| `lib/server/auth/` | Konten, Anmeldung, Sitzungen, Bremse, Protokoll |
| `scripts/` | die Hilfsbefehle für die Kommandozeile |
| `tests/` | Server-Tests, laufen mit `npm run test:server` |

### Hilfsbefehle

| Befehl | Zweck |
|---|---|
| `npm run keygen` | neuen Hauptschlüssel erzeugen |
| `npm run team -- superuser <name> "<Name>"` | den Superuser anlegen |
| `npm run team -- passwort-reset <name>` | Passwort zurücksetzen |
| `npm run team -- liste` | Konten auflisten |
| `npm run smtp:pruefen` | Mailserver testen, ohne eine Mail zu schicken |
| `npm run db:cleanup` | abgelaufene Daten löschen (täglich per Cron) |
| `npm run db:seed` | Beispieldaten für die Entwicklung |
| `npm run test:server` | Tests |
| `npm run dev` | Entwicklungsserver |

### Noch offen

- Seiten für **Datenschutzerklärung und Impressum** fehlen und gehören vor dem echten Betrieb dazu.
- Der **Datenschutzbeauftragte** der Schule sollte Aufbewahrungsfristen und Protokoll einmal prüfen.
- „Link verloren“: Eine Lehrkraft, die ihren Link verliert, kann ihn noch nicht selbst per Mail neu anfordern. Der Baustein dafür (`neueZugangslinks`) ist serverseitig da, die Seite fehlt.
