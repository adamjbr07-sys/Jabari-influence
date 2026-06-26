# Design System — Content OS (v2)

## Product Context
- **What this is:** A personal content production machine for one creator — idea bank,
  make-shootable, daily film queue, results log, winner-loop, "generate tomorrow's batch."
- **Who it's for:** @adam.jbrr (and one operator). Single user, daily driver, phone + laptop.
- **Space/industry:** Creator tooling / short-form (TikTok + Instagram) growth.
- **Project type:** Web app (Next.js 16), mobile-first, also two-pane on desktop.

## Aesthetic Direction
- **Direction:** Scoreboard. The memorable thing: opening it should feel like *"I'm winning / on pace."*
- **Decoration level:** Intentional (not minimal, not expressive). Decoration earns its place by
  showing momentum: the pace line, winner stars, ahead/behind deltas.
- **Mood:** Competitive, alive, in-control. Numbers are big and proud. Amber = momentum. Dark,
  focused, no corporate gloss, no marketing fluff. Creator-tool energy, not SaaS-dashboard energy.
- **Reference:** the shipped app's own language + the approved wireframe at
  `~/.gstack/projects/adamjbr07-sys-Jabari-influence/designs/machine-dashboard-20260626/`.

## Typography
- **Display/Hero:** Geist (already loaded via `next/font/google`, `--font-geist`). Big, tight
  tracking on numbers (`tracking-tight`, weight 800) — the counts are the hero.
- **Body:** Geist. Min 16px for body text (a11y).
- **UI/Labels:** Geist. Eyebrows are 10-11px, 700 weight, uppercase, `0.12em` tracking, muted.
- **Data/Numbers:** Geist with `font-variant-numeric: tabular-nums` on follower counts, views,
  deltas, and pace figures so digits don't jitter as they update.
- **Code:** Geist Mono (only if ever needed; not core).
- **Loading:** self-hosted via `next/font` (already wired). No CDN.
- **Scale (px):** 10 eyebrow / 11 meta / 12.5 list-body / 14 card-body / 17 screen-title /
  20 stat / 28+ hero-number. Line-height 1.35-1.45 on text blocks.

## Color
- **Approach:** Restrained neutrals + one loud accent (amber as momentum).
- **Primary (accent):** `#f59e0b` (amber-500) — momentum, the primary CTA, winner stars,
  "ahead"/progress. Black text on amber for contrast.
- **Neutrals (dark, cool):** bg `#09090b` (zinc-950) / surface `#18181b` (zinc-900) /
  surface-2 `#27272a` (zinc-800) / border `#27272a` / muted text `#a1a1aa` (zinc-400) /
  faint `#71717a` (zinc-500, use sparingly — keep body contrast >=4.5:1) / text `#fafafa`.
- **Semantic:** ahead/success `#4ade80` (green-400) · behind/error `#f87171` (red-400) ·
  warning `#f59e0b` (shares amber) · info/shootable `#7dd3fc` (sky-300).
- **Status pills:** idea = zinc-800/zinc-400 · shootable = sky · queued = amber ·
  posted = green. Winner badge = amber star.
- **Dark mode:** dark IS the only mode (forced `color-scheme: dark`). No light theme.

## Spacing
- **Base unit:** 4px.
- **Density:** Comfortable-leaning-dense (scoreboard packs info but stays scannable).
- **Scale:** 2(2xs) 4(xs) 8(sm) 12 16(md) 24(lg) 32(xl) 48(2xl).
- **Touch targets:** 44px minimum for any tappable control (pills, chips, nav, buttons).

## Layout
- **Approach:** Mobile-first single column; desktop two-pane (DR1).
- **Grid:** Mobile = one column, `max-w-2xl` centered. Desktop (>= lg) = two panes:
  left = idea bank + today's queue, right = pace line + results.
- **Max content width:** `max-w-2xl` per column.
- **Navigation:** Today / Bank / Results. Bottom nav on mobile (real line icons, NOT emoji),
  header segmented control on desktop. Current section visually indicated (amber).
- **Border radius:** sm 8px (pills/chips) · md 12px (list rows) · lg 14px (cards) · full 9999px
  (nav, segmented control).

## Motion
- **Approach:** Minimal-functional, with ONE celebratory exception: the winner star animates
  in once when a post crosses the winner threshold (the reward moment — serves "I'm winning").
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** micro 80ms (button press/scale), short 200ms (state changes), medium 350ms
  (winner-star pop). Respect `prefers-reduced-motion` (disable the pop).

## Accessibility (non-negotiable, from design review)
- Body text >= 16px; contrast >= 4.5:1 (audit zinc-500 on zinc-950 before shipping it on text).
- 44px min touch targets.
- Visible focus states on all interactive elements.
- ARIA label + text alternative on the pace line / sparkline (it conveys data, not decoration).
- Keyboard navigable bank/queue lists.
- Pace "behind" framed as "X to go today," not just red — drives action, stays accessible.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-26 | Initial design system created | /design-consultation; formalizes the shipped zinc-950/amber-500/Geist language + the v2 plan's review decisions |
| 2026-06-26 | Scoreboard direction, amber = momentum | Memorable thing: opening the tool should feel like "I'm winning / on pace" |
| 2026-06-26 | Geist + tabular-nums for all figures | Counts/views/deltas are the hero; digits must not jitter on update |
| 2026-06-26 | Desktop two-pane, mobile single column | Design review DR1 (laptop curation + phone-first capture) |
| 2026-06-26 | Real nav icons, not emoji | AI-slop fix from design review (Pass 4) |
