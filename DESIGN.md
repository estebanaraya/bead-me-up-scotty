---
name: Bead Me Up, Scotty
description: A local web GUI for Beads, with a cross-project home that reads every project's progress at a glance.
colors:
  brand: "#6d5ef0"
  brand-2: "#5546e0"
  brand-weak: "#efedfd"
  bg: "#f6f6f8"
  surface: "#ffffff"
  surface-2: "#f1f1f4"
  surface-3: "#ebebef"
  border: "#e7e7ec"
  border-strong: "#d6d6dd"
  text: "#16161a"
  text-2: "#62626d"
  text-3: "#9a9aa5"
  destructive: "#ef4444"
  brand-dark: "#8b7cf8"
  brand-2-dark: "#9c8ffa"
  brand-weak-dark: "#211d3a"
  bg-dark: "#0c0c0f"
  surface-dark: "#161619"
  surface-2-dark: "#1d1d22"
  surface-3-dark: "#26262d"
  border-dark: "#26262d"
  border-strong-dark: "#34343d"
  text-dark: "#f2f2f5"
  text-2-dark: "#a2a2ad"
  text-3-dark: "#6c6c77"
  status-done: "#16a34a"
  status-wip: "#d97706"
  status-blocked: "#ef4444"
  status-frozen: "#64748b"
  status-active: "#3b82f6"
typography:
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 680
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  nav:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.3
  meta:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    letterSpacing: "0.04em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
rounded:
  base: "0.7rem"
  row: "8px"
  control: "9px"
  mark: "10px"
  card: "11px"
  tile: "14px"
  dialog: "16px"
  pill: "9999px"
spacing:
  row-y: "5px"
  phase-gap: "10px"
  tile-gap: "12px"
  grid-gap: "14px"
  tile-pad: "16px"
  section-gap: "18px"
  page-x: "28px"
  page-x-narrow: "16px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.base}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.base}"
    height: "28px"
    padding: "0 10px"
  button-outline-hover:
    backgroundColor: "{colors.surface-2}"
  tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  needs-strip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
    padding: "14px 16px"
  ask-row-hover:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.row}"
    padding: "5px 6px"
  nav-item:
    textColor: "{colors.text-2}"
    typography: "{typography.nav}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.brand-weak}"
    textColor: "{colors.brand}"
  lead-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  phase-meter-track:
    backgroundColor: "{colors.surface-3}"
    rounded: "{rounded.pill}"
    height: "6px"
  phase-meter-fill:
    backgroundColor: "{colors.brand}"
    rounded: "{rounded.pill}"
    height: "6px"
---

# Design System: Bead Me Up, Scotty

## Overview

**Creative North Star: "The Quiet Console"**

Scotty is a dense, calm working tool: neutral grey grounds, white bordered surfaces, one violet brand accent, and small precise type in Geist. Everything reads as an instrument panel for someone who glances and goes. Colour carries meaning, not decoration: the brand marks progress, selection and the app mark; green and amber dots carry status; the rest is greyscale.

The system is token-driven at the raw-palette level. `app/globals.css` defines a raw palette (`--bg`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--text`, `--text-2`, `--text-3`, `--brand`, `--brand-2`, `--brand-weak`, `--shadow`, `--shadow-lg`) and maps shadcn's semantic tokens onto it. Light is `:root`, dark is `.dark`, and seven named dark themes override only the raw palette, so every surface built on the raw tokens re-themes for free. The home (`app/page.tsx`, `components/home/*`) is built on exactly these tokens and the `components/ui` primitives; it adds no new colours or fonts.

Density is high and type is small (11 to 17px on working surfaces; 20px for the detail drawer title and 22px for insight figures). Hierarchy comes from weight steps (500, 550, 650, 680) and the three text greys, not from size jumps.

**Key Characteristics:**
- Neutral grey canvas, white surfaces, 1px borders, a whisper of ambient shadow.
- One violet brand accent per theme; status shown as small coloured dots with a word, never as colour alone.
- Geist sans everywhere, Geist Mono for ids and counts in the incumbent views; tabular numerals on every count.
- Raw-palette tokens so light, dark and seven named themes share one component vocabulary.
- Fine-grained weights (550, 650, 680) instead of large size changes.

## Colors

A cool-neutral greyscale with a single saturated violet, re-pointed per theme.

### Primary
- **Signal Violet** (`brand`; dark `brand-dark`): progress bars, active navigation text, the app mark tile, the focus outline, the lead chip's dot, the needs-you count badge. It is the only chromatic colour that is not a status.
- **Deep Violet** (`brand-2`): the brand's second step, used as a secondary accent in theme definitions.
- **Violet Wash** (`brand-weak`): the active navigation row's background.

### Neutral
- **Canvas Grey** (`bg`): page background behind every surface.
- **Paper** (`surface`): tiles, the needs strip, the sidebar, popovers, cards.
- **Mist** (`surface-2`): hover fill for rows and ghost controls, chip fill, secondary and muted backgrounds.
- **Fog** (`surface-3`): progress tracks, inline code background, skeletons.
- **Hairline** (`border`) and **Firm Hairline** (`border-strong`): resting borders and their hover or emphasis step.
- **Ink** (`text`), **Slate** (`text-2`), **Ash** (`text-3`): primary text, secondary text and metadata, and tertiary marks.

### Status hues
Defined once in `lib/beads-view.ts` (`CAT_COLORS`) and identical across themes: `status-done` green, `status-wip` amber, `status-blocked` red, `status-frozen` slate, `status-active` blue. The home reads them through `catColor()` rather than restating them.

### Named themes
`html[data-theme=…]` blocks override the raw palette only, with brand values: dracula `#bd93f9`, nord `#88c0d0`, solarized-dark `#268bd2`, gruvbox-dark `#fabd2f`, tokyo-night `#7aa2f7`, catppuccin-mocha `#cba6f7`, rose-pine `#c4a7e7`. All are dark-mode, so `.dark` also applies.

### Named Rules
**The Raw Palette Rule.** Style surfaces with the raw tokens (`var(--surface)`, `var(--text-2)`) or the shadcn semantics mapped onto them. A literal hex in a component does not follow the named themes.

**The Dot And Word Rule.** Status is a 5 to 7px dot in a status hue beside a plain word ("Moving", "Slow", "Out of date"). The hue never carries the meaning alone.

**The One Accent Rule.** Brand violet marks progress, selection and identity. It is not a fill for large areas or a second text colour for body copy.

## Typography

**Display Font:** none; the system has no display role.
**Body Font:** Geist (`--font-geist-sans`, via `next/font`), set on `html` as `font-sans`.
**Label/Mono Font:** Geist Mono (`--font-geist-mono`) for issue ids, XP and counts in the incumbent views and the lead id tooltip.

**Character:** One neutral grotesque at small sizes, tightened slightly at heading weights. It reads as tooling, not editorial.

### Hierarchy
- **Title** (680, 16px, 1.2, -0.01em): the page title in the home header ("Overview").
- **Headline** (650, 17px, 1.25, -0.015em): section and tile headings: "Needs you now", each project name, epic headings.
- **Nav** (500, 13.5px; 600 when active): sidebar rows.
- **Body** (400, 13px, 1.45): status prose (Moved, Next), ask text at 13.5px in the needs strip.
- **Body small** (400, 12.5px, 1.3): phase titles, ask list rows, empty-state lines.
- **Meta** (400, 12px and 11.5px): pace line, timestamps, footer counts, "as of" lines; always `text-2`, `tabular-nums` on numbers.
- **Label** (650, 11px, 0.04em, uppercase): small group headings inside a surface ("Open questions (2)", field labels in the detail drawer, list group headers). Use `text-2` where the label must be read.

### Named Rules
**The Weight Not Size Rule.** Separate levels with weight (500, 550, 650, 680) and the three text greys before reaching for a larger size. List and tile surfaces stay at or below 17px; larger sizes are reserved for a single drawer title (20px) and stat figures (22px).

**The Tabular Count Rule.** Every number that can change (done of total, waiting time, question counts) uses `tabular-nums`.

## Layout

Two-pane app shell: a resizable left sidebar (default 228px, 180 to 400px, hidden below 768px where it moves into a sheet) and a main pane. The home has no sidebar: a full-width header (16px horizontal padding, 28px from 640px up, 14px vertical, bottom border) over a scrolling main area capped at 1320px and centred.

Home rhythm: 18px between the needs strip and the tile grid; tile grid is one column, two from 640px, three from 1024px, with a 14px gap and `items-start` so tiles keep their own height. Inside a tile: 12px between blocks, 10px between phase meters, 3px between name and pace line, footer separated by a top border and 10px.

Loading states are skeleton shells at the typical loaded heights, so nothing jumps when data lands.

## Elevation & Depth

Flat with a whisper. Surfaces sit on the canvas through a 1px border plus an ambient shadow; overlays (dialogs, the command palette) take the larger shadow. Hover on a tile changes the border to `border-strong`, not the shadow.

### Shadow Vocabulary
- **Ambient** (`--shadow`; light `0 1px 2px rgba(20,20,30,.05), 0 1px 1px rgba(20,20,30,.04)`, dark `0 1px 2px rgba(0,0,0,.4)`): every resting surface: tiles, needs strip, board cards, epic groups.
- **Overlay** (`--shadow-lg`): dialogs, the command palette, the folder browser, focus-view hover.
- **Brand glow** (`0 2px 8px -2px var(--brand)`): the app mark tile only, in the sidebar and the home header.

### Named Rules
**The Border First Rule.** Resting surfaces separate by border and canvas contrast; shadow is ambient, never a lift effect on hover.

## Shapes

Rounded rectangles throughout, sized by role: 8px for list rows inside a surface, 9px for sidebar controls, 10px for the app mark, 11px for board and focus cards, 14px for top-level page surfaces (home tiles, the needs strip, epic groups), 16px for dialogs, full pills for chips, badges, dots and progress bars. The shadcn primitives derive their radii from `--radius` (0.7rem).

## Components

### Buttons
- **Shape:** `components/ui/button.tsx`; rounded-lg from `--radius`, a smaller step for `sm`.
- **Primary:** brand fill, `primary-foreground` text, 32px tall; hover drops to 80% brand.
- **Outline:** border, canvas fill, 28px at `sm`; hover and open state fill with `muted`. The home header's Projects and Refresh use this.
- **Focus:** 3px `ring` at 50% plus ring-coloured border; pressed nudges down 1px.

### Chips
- **Lead chip:** full pill, `surface-2` fill, 1px border, 11.5px medium `text-2`, a 5px brand dot; hover lifts border and text one step. Opens the lead session; the full id shows in a mono tooltip.

### Cards / Containers
- **Corner Style:** 14px for page-level surfaces.
- **Background:** `surface` on `bg`.
- **Shadow Strategy:** Ambient (see Elevation).
- **Border:** 1px `border`, `border-strong` on hover for clickable tiles.
- **Internal Padding:** 16px (tile), 14px by 16px (needs strip).

### Navigation
- **Sidebar rows:** 13.5px, 9px radius, 8px by 10px padding, 17px icon; resting `text-2`, hover `surface-2` and `text`, active `brand-weak` fill with brand text at 600.
- **Overview link:** the first sidebar row, styled as a resting nav row, leads home.
- **Project switcher:** a dropdown with project list, Add project, Overview and Manage projects.
- **Home Projects menu:** outline `sm` button opening "Open a board", Add project and Manage projects.

### Project Tile (signature)
The home's unit. Name as a headline whose link stretches over the whole tile; pace line (dot and word, last moved, done this week); up to two phase meters, then "+N more phases"; the lead's Moved and Next lines clamped to three lines with an "as of" date and an amber "Out of date" dot when stale; footer with question counts, the lead chip and a Details toggle. Details grows the tile downward in place (grid-rows 0fr to 1fr, 200ms ease-out) revealing the hidden phases, the full status and the ask lists; neighbours keep their size. Interactive children sit above the stretched link (`z-10`), never nested inside it.

### Phase Meter (signature)
Title left and "done of total" right on one baseline (12.5px), then a 6px pill track in `surface-3` with a brand fill; width animates over 300ms. Exposed as a `progressbar` with the same numbers.

### Needs Strip (signature)
A full-width 14px surface listing at most one ask per project as a link row: project name (12px, 600, `text-2`), ask text (13.5px), wait time ("waiting 20h", tabular). Three columns from 640px, stacked below. Empty state is one plain sentence.

## Do's and Don'ts

### Do:
- **Do** build page-level surfaces as 14px-radius `surface` panels with a 1px `border` and `--shadow`.
- **Do** show status as a dot in a status hue from `catColor()` beside a plain word.
- **Do** use brand violet for progress fills, selection and the app mark, and nowhere as a large fill.
- **Do** honour `motion-reduce` on every transition (reveal, chevron, meter width, spinner).
- **Do** keep numbers `tabular-nums` and in `text-2`.
- **Do** draw keyboard focus visibly; inside clipping parents, use the 2px brand outline inset by 2px.

### Don't:
- **Don't** write literal hex in components; use the raw palette tokens so the named themes apply.
- **Don't** use `text-3` for text that must be read; it is for icons, chevrons, idle dots and disabled marks.
- **Don't** lift surfaces with shadow on hover; change the border.
- **Don't** nest an interactive control inside another; stretch the primary link and raise the others above it.
