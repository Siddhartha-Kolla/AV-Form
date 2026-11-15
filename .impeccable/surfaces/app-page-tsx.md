---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Surface brief: Anmeldeformular (app/page.tsx)

Mode: Operate. Teachers fill a registration form once, at a desk or on a phone.

Audience and job: Lehrkräfte, not technical. Register an event early, name the technology needed, attach documents. Success is an early, complete registration and the knowledge that a private link follows by email.

Constraints: German UI, self-hosted fonts, no third-party scripts, antislop.md rules (see PRODUCT.md), PDF field names, order and numbering stay. No wizard.

Open decisions: accent colour, school name or logo, dark mode, upload size limit.

## Direction contract

THESIS: A plain, familiar form at Stripe and Tally craft. One flowing column, no gimmick, no card around sections. It refuses the experimental-world look and the generic AI-SaaS look.

OWN-WORLD: Near-white page, tinted neutral ink, one deep teal accent used only for the primary button, focus rings and checked states. One workhorse sans, self-hosted. Small radii (about 6px), 1px neutral borders, no shadows except the focus ring. Quiet group labels in sentence case.

STORY: The teacher sees a short intro, works down numbered sections 1 to 7 and understands the deadline for the chosen event type live. After sending they know what happens next.

FIRST VIEWPORT: Left-aligned heading "Veranstaltung anmelden" and two sentences of intro in a 700px column. Directly below, section 1 with title field full width and teacher, email, date, times in a tidy grid. No hero, no nav bar beyond a small wordmark.

FORM: canon, the category standard played straight (standing exit chosen by the user), seed:5210fc3936de43ed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
