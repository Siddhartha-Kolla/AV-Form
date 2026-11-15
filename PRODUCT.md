# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: teachers (Lehrkräfte)** at a school who register an event they are responsible for. They fill the form once, usually at a desk, are not technical, and know their event but not AV vocabulary. They return later to change details or upload documents (script, schedule, mic plan, slides). No passwords, no account creation: access is by emailed magic link.

**Secondary: the school's Technikteam** (students; stage, light, sound, media). They receive notification emails and use a password-protected overview of all registrations to plan people and equipment. The author of this project is a student on that team.

Whether all teachers share one school email domain is unknown.

## Product Purpose

Replace a three-page PDF form ("Veranstaltungsanmeldung Technikteam"). Teachers currently approach the team at very short notice. The app makes them register events early, state exactly which technology they need, and upload documents, so the team can plan people and equipment in time. Success: registrations arrive before the deadline for their event type, with enough detail that the team does not have to chase teachers.

## Positioning

Internal tool for one school team, not a product. It mirrors that team's own PDF: field names, numbering and wording come from the PDF and are kept. Its difference from a generic form builder is the event-type logic (deadlines and required documents per type) and the returning-teacher flow (magic link, versioned uploads).

## Operating Context

- UI language is German; keep copy short.
- Event types (multi-select): Theater, Konzert, Informationsveranstaltung, Podiumsdiskussion, Vortrag, Sonstiges. Deadlines: Theater/Konzert at least 4 weeks ahead; Info/Podium/Vortrag at least 2 weeks; Sonstiges by arrangement. With several types the longest deadline applies. Earlier is always welcome.
- Form sections, numbered as in the PDF: 1 Allgemeine Informationen, 2 Art der Veranstaltung, 3 Benötigte Technik (Ton, Licht, Medien, Bühne), 4 Betreuung, 5 Technische Details, 6 Termine (Probe, Generalprobe, Aufbau, Veranstaltung, Abbau), 7 Sonstige Anmerkungen. Closing notice: changes should be reported as early as possible; short-notice changes may not be possible.
- Required documents depend on event type (e.g. Theater: full script with light cues in green and sound cues in red; Konzert: programme order and mic plan; Podium/Vortrag: schedule, mic assignment, presentations). The schedule (Ablaufplan) describes the event's timeline, not the technical plan.
- Full field list and rules: `CLAUDE.md` and `anforderungen.md` in the repo root.

## Capabilities and Constraints

- Stack: Next.js App Router, TypeScript, fully self-hosted. **No Appwrite or other BaaS**: the app owns its storage and architecture. shadcn/ui (Base UI, Tailwind 4) is initialised. Earlier CLAUDE.md sections on Appwrite are superseded.
- Storage: SQLite on the school server (user wants strong data security; confirmed approach below), uploaded files on local disk outside the public web root.
- Teacher access: a private, unguessable link per registration, emailed on submit. No user accounts, no sessions for teachers. Whoever holds the link may view and edit that registration and add files.
- Team access: a password-protected overview page listing all registrations (sorted by date), with a link into each one. The user wants it to be a good, well-designed overview, not a bare table. It replaces the Appwrite Console and notification-only workflow.
- Email: the school's SMTP server sends the link to the teacher and notifications to the team. Credentials still to be obtained from school IT.
- Scope: keep the teacher side simple. One flat form page, no wizard. The only conditional logic is which upload fields show for the chosen event types, plus the deadline notice. The team overview is the one deliberate addition beyond the original "no dashboard" stance.
- Deadline check is a soft notice (does not block submit); proposed in CLAUDE.md, not yet confirmed by the school.
- Privacy (DSGVO): EU hosting, minimal data (name, email, event data), automatic deletion some months after the event (proposal: 6 months, to be agreed with the school), no tracking, no third-party fonts or scripts, privacy policy and imprint pages required.
- Threat model (confirmed, user calls it very important): data must stay protected even if someone breaks into the running server. Disk encryption alone does not cover this. Confirmed approach (2026-11-15): encrypt name, email, free text and uploads in the app (AES-256-GCM, key kept outside the data folder and backups), keyed hash of email for lookup, unprivileged app user, uploads outside web root served through an authorised route, hashed tokens and passwords, rate limiting, scheduled deletion. Full compromise of the app process cannot be fully prevented; the aim is that one bug is not a total breach.
- Hosting: school server (confirmed). Open: whether Node.js or Docker can run there, TLS/reverse proxy, backups.
- Open decisions: spam protection for the unauthenticated submit (depends on teachers' email domain, unknown); upload size limit and allowed file types; how team members log in (shared password vs per-person); retention period; whether SQLite security is accepted by the school's data protection officer.

## Brand Commitments

Binding, decided 2026-11-15: the design takes the conventional route ("Standardlösung"): a plain, simple, familiar form, executed with modern craft so it still looks stylish. The user explicitly does not want the more experimental visual worlds offered by the design tool (DIN sheet, timetable, dense modules, register tabs, and so on). The earlier CLAUDE.md design brief (monochrome, IBM Plex Sans, no cards) is superseded. The PDF's section structure and German field labels remain the content source of truth.

`antislop.md` in the repo root holds the user's design and writing rules and is binding for all UI and copy work. In short: no generic SaaS look, no purple/blue/pink gradients, glows, blobs or glassmorphism; no oversized rounding or pill buttons; no nested or endless cards; no icon-in-coloured-square rows; no emoji icons; few badges, chips and uppercase labels; no decorative stats, random shadows or lines; no giant centred hero; whitespace only with a purpose; minimal motion and respect for reduced motion. Copy is specific, natural German with no marketing phrases, no em-dashes, no "nicht nur X, sondern Y" constructions, no filler phrases, few parentheticals, varied sentence length. Never invent testimonials, statistics or capabilities. Every interaction must work, with loading, empty, error and success states, semantic HTML, visible focus, sufficient contrast, and responsive layouts.

## Evidence on Hand

- `CLAUDE.md` and `anforderungen.md`: requirements and field list (still valid). The Appwrite data model, page structure and implementation order in CLAUDE.md are superseded.
- The original three-page PDF is referenced but not in the repo.
- No real registrations, testimonials, or usage data exist. Do not invent any.

## Product Principles

1. Simplest thing that works: a flat form and plain lists beat clever flows. Flag anything that adds complexity.
2. Teachers should finish in one sitting without knowing AV terms; labels and hints explain, not assume.
3. The team's planning needs drive the fields: capture early, capture exactly, and make changes visible.
4. No accounts or passwords for teachers: the private link is the only door, and a lost link must be recoverable (e.g. by resending it to the registered email).
5. Privacy by minimum: collect little, delete on schedule, load nothing from third parties.

## Accessibility & Inclusion

No product-specific standard established. Users are adult teachers on mixed devices; the form must work on phones (single column) and with keyboard-only input.
