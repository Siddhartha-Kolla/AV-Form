# Veranstaltungsanmeldung Technikteam

## Kontext

Ich bin Schüler und Mitglied des Technikteams meiner Schule (Bühnentechnik, Licht, Ton, Medien). Lehrer sprechen uns bisher oft sehr kurzfristig auf Veranstaltungen an. Wir bauen deshalb eine Webanwendung, über die Lehrkräfte Veranstaltungen frühzeitig anmelden, die benötigte Technik angeben und Unterlagen hochladen. Das Technikteam plant daraus Personal und Technik.

Als Vorlage gibt es ein fertiges dreiseitiges PDF-Formular. Dessen Struktur und Feldbezeichnungen werden hier übernommen. Die ursprünglichen Anforderungen stehen in `docs/anforderungen.md`. Ich kenne Next.js (App Router) und gelegentlich Vite, kein Svelte.

## Grundsätze

- So einfach wie möglich. Ein einseitiges Formular, kein Wizard, keine bedingte Formularlogik beim Start.
- Kein eigenes Dashboard im ersten Schritt. Das Team arbeitet mit Benachrichtigungsmails, Links zu den Anmeldungen und der Appwrite Console als Übersicht.
- Keine Passwörter und keine Registrierung. Lehrkräfte greifen über einen Magic Link per E-Mail auf ihre eigene Anmeldung zu.
- DSGVO: EU-Hosting, so wenig Daten wie möglich, Löschkonzept, kein Tracking, keine externen Analytics-Skripte.
- UI-Sprache ist Deutsch. Texte kurz halten.

## Stack

- Frontend: Next.js (App Router), TypeScript
- Backend: Appwrite Cloud, Region Frankfurt. Später eventuell self-hosted, Appwrite hat dafür eine eingebaute Migration in der Console.
- Appwrite-Bausteine: Auth (Magic URL), Databases (TablesDB API), Storage, Functions, Teams
- Hosting Frontend: noch offen, siehe "Offene Entscheidungen"
- Pakete: `appwrite` für den Browser, `node-appwrite` für Server-Code

Appwrite hat die Datenbank-Terminologie geändert: Tables, Rows, Columns statt Collections, Documents, Attributes. Die TablesDB API verwenden, nicht die alten Collection-Methoden. Auch im Auth-Bereich haben sich Methodennamen zwischen SDK-Versionen geändert, zum Beispiel `createMagicURLToken` und `createSession`. Vor dem Einbauen gegen die aktuelle Appwrite-Doku prüfen.

## Veranstaltungsarten und Fristen

Auswahl per Checkboxen, Mehrfachauswahl möglich:

| Wert | Anzeige | Frist |
|---|---|---|
| theater | Theater | mindestens 4 Wochen vorher |
| konzert | Konzert | mindestens 4 Wochen vorher |
| info | Informationsveranstaltung | mindestens 2 Wochen vorher |
| podium | Podiumsdiskussion | mindestens 2 Wochen vorher |
| vortrag | Vortrag | mindestens 2 Wochen vorher |
| sonstiges | Sonstiges (mit Freitextfeld) | nach Absprache |

Bei mehreren Arten gilt die längste Frist. Eine frühere Anmeldung ist immer erwünscht. Sobald Datum und Art gesetzt sind, prüft das Formular die Frist und zeigt bei Unterschreitung einen Hinweis.

## Formularfelder

Reihenfolge und Nummerierung wie im PDF. Pflichtfelder sind mit * markiert.

### 1 Allgemeine Informationen

- `titel` Titel der Veranstaltung *
- `lehrkraft` Verantwortliche Lehrkraft *
- `email` E-Mail-Adresse *
- `datum` Datum *
- `beginn` Beginn *
- `ende` Ende *
- `ort` Veranstaltungsort *

### 2 Art der Veranstaltung

- `arten` Liste aus den Werten der Tabelle oben
- `art_sonstiges` Freitext, nur relevant bei "sonstiges"

Fristen als kurzer Hinweistext darunter:
Theater und Konzerte: mindestens 4 Wochen vorher. Informationsveranstaltung, Podiumsdiskussion, Vortrag: mindestens 2 Wochen vorher. Sonstige Veranstaltungen: nach Absprache. Eine frühere Anmeldung hilft uns immer.

### 3 Benötigte Technik

Alles Checkboxen. Bei Mikrofonen und Headsets zusätzlich ein Zahlenfeld "Anzahl".

Ton
- `ton_kein` Kein Ton erforderlich
- `mikrofone` Mikrofone, dazu `mikrofone_anzahl`
- `headsets` Headsets, dazu `headsets_anzahl`
- `musik_desktop` Musikwiedergabe (Desktop)

Licht
- `licht_raumlicht` Raum- / Saallicht ausreichend
- `licht_buehne` Bühnenlicht
- `licht_spotlights` Spotlights

Medien
- `medien_beamer` Beamer / BIMA
- `medien_laptop` Laptopanschluss

Bühne
- `buehne_rednerpult` Rednerpult
- `buehne_notenstaender` Notenständer
- `buehne_notenpultleuchten` Notenpultleuchten
- `buehne_umbau` Bühnenumbau

### 4 Betreuung während der Veranstaltung

- `betreuung_ton` Tontechniker erforderlich
- `betreuung_licht` Lichttechniker erforderlich

Hinweistext: Ohne Betreuung richtet das Technikteam die Technik nach Möglichkeit vor Beginn ein und holt sie danach ab.

### 5 Technische Details

- `technische_details` Freitext, optional

Hinweistext: Optional, falls nicht bereits über Skript oder Ablaufplan abgedeckt: Mikrofonzuordnung, Zuspielungen, Besonderheiten.

### 6 Termine

Pro Termin drei Felder: Datum, Uhrzeit, Ort / Anmerkung.

- `probe_datum`, `probe_uhrzeit`, `probe_ort` (Probe(n), Freitext erlaubt für mehrere Termine)
- `generalprobe_datum`, `generalprobe_uhrzeit`, `generalprobe_ort`
- `aufbau_datum`, `aufbau_uhrzeit`, `aufbau_ort`
- `veranstaltung_datum`, `veranstaltung_uhrzeit`, `veranstaltung_ort`
- `abbau_datum`, `abbau_uhrzeit`, `abbau_ort`

### 7 Sonstige Anmerkungen

- `anmerkungen` Freitext, Label: Weitere Informationen oder besondere Wünsche

### Hinweis am Ende des Formulars

Nachträgliche Änderungen bitte so früh wie möglich mitteilen. Kurzfristige Änderungen können je nach Umfang nicht mehr umgesetzt werden.

## Einzureichende Unterlagen je Veranstaltungsart

Diese Unterlagen werden im Formular als Datei-Uploads angeboten. Welche Upload-Felder sichtbar sind, hängt von den gewählten Arten ab. Das ist die einzige bedingte Logik im Formular.

Theater
- Vollständiges Skript
- Licht-Cues im Skript grün markiert, Ton-Cues rot markiert. Beispiel: "Übergang zu Cue 2", "Türgeräusch abspielen"
- Hinweise zu Spotlights und Beamer / BIMA
- Sonstige technische Hinweise

Konzert
- Ablauf mit Reihenfolge der Programmpunkte und Pausen
- Lichteffekte mit Zeitpunkt des Wechsels
- Mikrofonplan: Person zu Mikrofon, gegebenenfalls Kanalzuordnung
- Musikeinspielungen und Zuspielungen

Podiumsdiskussion
- Ablaufplan
- Mikrofonanzahl und Zuordnung zu Personen
- Gegebenenfalls Mikrofon für Publikum / Fragerunde
- Präsentationen oder Videos
- Hinweise zu Beamer / BIMA, gewünschte Lichtstimmung

Informationsveranstaltung / Vortrag
- Ablaufplan
- Mikrofonanzahl und Zuordnung
- Präsentationen oder Videos
- Hinweise zu Beamer / BIMA, gegebenenfalls Lichtstimmung

Der Ablaufplan zeigt den zeitlichen Ablauf der Veranstaltung und ist kein technischer Plan: Proben, Einlass, Beginn, Reihenfolge der Programmpunkte, Pausen, Ende, besondere Umbauten.

Dateikategorien für die Datenbank: `skript`, `ablaufplan`, `mikrofonplan`, `praesentation`, `zuspielung`, `sonstiges`.

## Datenmodell in Appwrite

### Tabelle `anmeldungen`

Eine Spalte pro Formularfeld wie oben, dazu:
- `owner_id` Appwrite-User-ID der Lehrkraft

Zeitstempel (`$createdAt`, `$updatedAt`) liefert Appwrite automatisch.

Berechtigungen pro Zeile: Lesen und Aktualisieren für `Role.user(owner_id)` und `Role.team('technikteam')`. Kein öffentlicher Zugriff auf die Tabelle.

### Tabelle `dokumente`

Appwrite-Storage-Dateien tragen keine eigenen Metadaten. Deshalb gibt es eine Tabelle, die Dateien den Anmeldungen zuordnet.

- `anmeldung_id`
- `kategorie` (siehe Dateikategorien)
- `file_id` ID der Datei im Bucket
- `dateiname`
- `version` Ganzzahl, pro Anmeldung und Kategorie hochzählend
- `ist_aktuell` Boolean

Gleiche Berechtigungslogik wie bei `anmeldungen`.

### Bucket `dokumente`

Dateiberechtigungen wie bei den Zeilen. Erlaubte Typen: pdf, docx, doc, pptx, odt, txt, mp3, wav. Größenlimit festlegen und im Formular anzeigen.

### Team `technikteam`

Alle Mitglieder des Technikteams. Sie sehen alle Anmeldungen und Dateien.

## Versionshistorie

Beim Hochladen einer neuen Datei in derselben Kategorie bleibt die alte Datei liegen. Der alte Eintrag in `dokumente` bekommt `ist_aktuell = false`, der neue `version + 1` und `ist_aktuell = true`. Die Anmeldungsseite zeigt pro Kategorie eine einfache Liste, zum Beispiel:

- Skript, hochgeladen 12.09.
- Skript, hochgeladen 15.09., aktuell

Kein Diff, kein Rollback. Nur nachschauen und herunterladen.

## Zugriff für Lehrkräfte

Ablauf:
1. Die Lehrkraft füllt das Formular aus und sendet es ab.
2. Die Anmeldung wird gespeichert, die Lehrkraft bekommt per E-Mail einen Magic Link zu ihrer Anmeldung.
3. Der Klick auf den Link führt zu `/anmeldung/bestaetigen`. Die Seite liest `userId` und `secret` aus der URL und erzeugt daraus eine Session.
4. Danach Weiterleitung zu `/anmeldung/[id]`. Dort kann die Lehrkraft Felder ändern und neue Dateiversionen hochladen.

Der Magic Link ist nur kurz gültig, laut Appwrite-Doku eine Stunde. Eine bestehende Session hält deutlich länger. Wer später ohne Session zurückkommt, braucht eine Seite `/zugriff`, auf der man die E-Mail-Adresse eingibt und einen neuen Link anfordert.

## Benachrichtigung ans Technikteam

Eine Appwrite Function, ausgelöst durch Events der Tabelle `anmeldungen` (Create und Update) und der Tabelle `dokumente` (Create). Sie verschickt eine Mail an die Team-Adresse mit:
- Art des Ereignisses: neue Anmeldung, Änderung, neue Dateiversion
- Titel, Datum, Lehrkraft
- Link zur Anmeldung

Bei Updates möglichst die geänderten Felder auflisten. Das hilft bei kurzfristigen Änderungen am meisten.

## Seitenstruktur

- `app/page.tsx` Formular
- `app/zugriff/page.tsx` Magic Link erneut anfordern
- `app/anmeldung/bestaetigen/page.tsx` fängt den Magic Link ab und erzeugt die Session
- `app/anmeldung/[id]/page.tsx` eigene Anmeldung ansehen und bearbeiten, Dateien hochladen, Versionsliste
- `app/datenschutz/page.tsx` und `app/impressum/page.tsx`

Formularvalidierung mit zod, Formularzustand mit react-hook-form oder reinen Server Actions.

## Design

Das Design soll dem PDF entsprechen: minimalistisch und professionell.

- Nur Schwarz, Weiß und Grautöne. Keine Akzentfarbe, kein Blau.
- Schrift: IBM Plex Sans
- Überschriften mit Nummer und Titel, ohne Trennlinien darunter. Struktur entsteht durch Weißraum.
- Keine Mittelpunkte als Trenner, keine Kästen und Karten, wo ein Abstand reicht.
- Labels klein und grau über den Feldern, Pflichtfelder mit *
- Checkboxen bündig zur Textlinie, gleichmäßige Abstände
- Gruppenlabels (Ton, Licht, Medien, Bühne) klein und grau über den jeweiligen Checkboxen
- Auf dem Handy einspaltig

## DSGVO

- Appwrite Cloud mit Region Frankfurt. Auftragsverarbeitungsvertrag mit Appwrite abschließen. Der Datenschutzbeauftragte der Schule sollte das Setup einmal prüfen.
- Gespeichert werden nur Name, E-Mail und die Veranstaltungsdaten.
- Löschkonzept: Anmeldungen und Dateien werden einige Monate nach dem Veranstaltungsdatum automatisch gelöscht, per zeitgesteuerter Appwrite Function. Die Frist wird mit der Schule festgelegt, Vorschlag sechs Monate.
- Kein Tracking, keine externen Fonts oder Skripte von Dritten. IBM Plex Sans lokal einbinden.
- Datenschutzerklärung und Impressum als Seiten vorsehen.

## Offene Entscheidungen

1. **Erste Speicherung ohne Login.** Die Lehrkraft hat beim Absenden noch keine Session. Empfehlung: Server Action oder Route Handler mit `node-appwrite` und API-Key. Der Server findet oder legt den User per E-Mail an, schreibt die Zeile mit Owner-Berechtigungen, lädt die Dateien hoch und löst den Magic Link aus. Dann braucht die Tabelle keine öffentlichen Schreibrechte. Dazu Spamschutz mit Honeypot-Feld und Rate Limit. Haben alle Lehrkräfte eine einheitliche Schul-E-Mail-Domain, kann das Formular nur diese Domain akzeptieren.
2. **Hosting des Frontends.** Vercel ist am einfachsten. Weil die Server-Route personenbezogene Daten verarbeitet, bräuchte Vercel einen AV-Vertrag und Funktionsregion Frankfurt. Alternativen: der Schulserver, falls dort Node.js läuft, oder ein anderer EU-Host.
3. **Fristprüfung.** Weicher Hinweis, der das Absenden erlaubt, oder hartes Blockieren. Vorschlag: weicher Hinweis, damit Ausnahmen per Absprache möglich bleiben.
4. **E-Mail-Versand.** Magic Link und Benachrichtigung über Appwrite Messaging oder über den SMTP-Server der Schule. Prüfen, was im Appwrite-Tarif möglich ist und welche Absenderadresse die Lehrkräfte sehen.
5. **Cloud oder self-hosted.** Start mit Cloud. Self-hosted braucht Docker, mindestens 2 CPU-Kerne und 4 GB RAM.

## Umsetzungsreihenfolge

1. Appwrite-Projekt anlegen: Tabellen, Bucket, Team, Auth-Methode Magic URL. Am besten als `appwrite.json` im Repo, damit das nächste Technikteam es nachbauen kann.
2. Formularseite mit allen Feldern und Validierung, noch ohne Backend.
3. Speichern und Datei-Upload, serverseitig.
4. Magic Link, Bestätigungsseite, Bearbeiten-Seite, `/zugriff`.
5. Versionierung der Dateien.
6. Benachrichtigungs-Function.
7. Löschfunktion, Datenschutzerklärung, Impressum.
8. README mit Setup-Anleitung für die Übergabe an das nächste Technikteam.
