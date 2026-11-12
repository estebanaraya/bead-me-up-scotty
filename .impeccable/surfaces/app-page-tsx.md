---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

## Scope

Scotty's home at `/` (spec `2026-11-12-scotty-home-design.md`, section 4). Visitor mode: operate. Extension inside Scotty's incumbent world; read-only, no write controls. Build path: code-led, no image generation.

## Direction contract

THESIS: every project's progress in plain terms, read at a glance. It refuses the category default of ticket rows, activity feeds and inflated totals: one tile per project saying how far, whether it moves, what moved, what is next.

OWN-WORLD: Scotty's incumbent tokens only (`--bg`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-2`, `--text-3`, `--brand`, `--shadow`), 14px-radius bordered surfaces, the platform sans, status hues green #16a34a and amber #d97706 as dots, `components/ui` primitives; light, dark and the named themes.

STORY: Esteban sees whether anything needs him, then where every project stands, and clicks into one project's board or one ask.

FIRST VIEWPORT: at 1440px, header (Overview, updated time, Projects menu, Refresh), the full-width "Needs you now" strip, then the first row of three tiles fully visible. Signature interaction: Details grows one tile downward in place; neighbours keep their size.

FORM: project tiles, seed 1f24685b (operate mode), chosen by Esteban.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
