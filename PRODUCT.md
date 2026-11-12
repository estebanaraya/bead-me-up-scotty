# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One user: Esteban, a creative technologist who runs several of his own and client projects at
once. Each project is driven by an agent lead (a Claude session) that dispatches worker agents and
records everything in Beads. Esteban directs; he does not work the tickets himself. He moves between
a Windows PC and a Mac through the day and runs Scotty locally on each.

He opens Scotty in two modes, glance first:

- **Glance:** between sessions or at the start of the day, about 30 seconds to learn where each
  project stands and whether anything needs him, then back to work or into one project.
- **Steering:** sometimes he stays to decide where his attention goes across projects, compares
  progress and pace, and acts on several things.

## Product Purpose

Scotty is a local web GUI for Beads (`bd`), the issue tracker his agents use. This fork
(`estebanaraya/bead-me-up-scotty`) adds a cross-project overview. Upstream Scotty is per project:
boards, Focus, Needs You, Activity, Epics, Insights.

Success: in one look Esteban knows, for every project, how far along it is, what moved lately,
whether it is moving or stalled, what comes next, and what needs him, in plain terms, without
reading agent-written tickets. From there one click takes him into any project's own views.

## Positioning

The overview translates agent bookkeeping into a director's view. Tickets stay written for agents;
this layer says what they mean for him. The overview is Scotty's home: everything starts there and
leads into the per-project views.

## Operating Context

- Beads data lives in a shared Dolt server per machine, synced through GitHub and DoltHub, so the
  PC and the Mac show the same projects. Scotty reads it by running `bd`; the project list is per
  machine in `~/.config/bead-me-up-scotty/config.json`.
- Projects today: claude-config, not-enough-space, Jaque, Studio, The Zoneboid, portfolio,
  the-mint, anomaly-mods, Sounder.
- Phases are epics labelled `phase`, unordered unless Esteban says one follows another. Children
  carry the work; closed over total children is the phase's completion.
- Decisions for Esteban are issues of type `decision`. Leads record `agent`, `lead`, `lead_title`,
  `model` and `effort` as issue metadata, and notes on each dispatch.
- The audit `events` table holds per-machine activity; changes pulled from another machine do not
  appear in it.

## Capabilities and Constraints

- Read-only overview: no writes from the overview page; actions happen in the per-project views or
  in the agent sessions.
- Localhost only; bound to the machine it runs on.
- Ticket titles and notes are written by agents for agents and must not be rewritten for the
  dashboard's sake.
- Counts inflated by bulk imports (the 2026-11-11 migration closed hundreds of issues at once) must
  not read as real progress.
- Undecided: where plain-language summaries come from (derived from data, written by the lead, or
  generated).

## Evidence on Hand

Live Beads data for the nine projects above, on both machines. Example phase completion on
2026-11-12: Jaque "Phase 3: First playable and prototype" 24 of 56; Studio "M3 · Build" 15 of 23;
anomaly-mods "PDA-5 · Map completion" 9 of 10. No user research beyond Esteban's own feedback.

## Product Principles

1. Say what it means for Esteban, not what the agents wrote.
2. The glance comes first: the top of the page answers "where is everything, and does anything need
   me" without scrolling or clicking.
3. Progress is shown as progress (phase completion, movement, pace, next step), never as a pile of
   tickets.
4. Every project is one click from its own views; the overview is the home, not a side page.
5. Numbers must be honest: no totals that bulk imports or bookkeeping can inflate.
