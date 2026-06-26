# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important:** This project uses Next.js 16, which has breaking changes from earlier versions. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the current API. Heed all deprecation warnings — APIs, conventions, and config keys may differ from training data.

---

## Commands

```bash
npm run dev      # Start dev server (Turbopack) at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npm run test     # Playwright E2E tests (requires dev server running)
npx tsc --noEmit # Type-check without building
```

The dev server also exposes `http://192.168.2.27:3000` on the local network (for phone testing on the same WiFi).

---

## Environment

AI features run on the host's **Claude subscription** via the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) — not `ANTHROPIC_API_KEY` per-token billing. Auth resolves from `CLAUDE_CODE_OAUTH_TOKEN` if set, otherwise the logged-in `claude /login` session. To connect on a host: run `claude setup-token` and set `CLAUDE_CODE_OAUTH_TOKEN`, or run `claude /login`.

Because the SDK spawns the `claude` CLI as a subprocess, the AI routes must run on a **Node.js host with the CLI installed** (the route handlers pin `runtime = 'nodejs'`). This does not work on Edge/serverless. If `ANTHROPIC_API_KEY` is set in the environment it takes precedence over the subscription and bills per-token — leave it unset to stay on the subscription. The app builds and serves without any auth, but AI features return a 500 with a user-facing message pointing to the setup steps.

---

## Architecture (v2 — content production machine)

See `PLAN.md` (build tasks T0-T12, decisions D1-D9) and `CONTRACT.md` (the schema +
ranking contract). The v1 two-tab generator (IdeaGenerator/HookGenerator/localStorage)
was replaced.

Three-tab client app in `src/app/page.tsx` (Today / Bank / Results), backed by Supabase.

**Layers:**
- `src/lib/types.ts` — the frozen contract: `Idea`/`Post` (1:many)/`FollowerLog`, status
  enums (idea: idea|shootable, post: queued|posted), ranking/pace function + I/O types, constants.
- `src/lib/db.ts` — server Supabase client. Reads `NEXT_PUBLIC_SUPABASE_URL` (NOT bare
  `SUPABASE_URL`, which the shell shadows) + `SUPABASE_SERVICE_ROLE_KEY`; throws a clear error
  when unconfigured so routes degrade gracefully.
- `src/lib/repo.ts` — the ONLY place that talks to Supabase. Pure row↔type mappers
  (snake_case+timestamptz ↔ camelCase+epoch-ms; `followerDeltaCandidate` stays null = D5
  ambiguity) + async CRUD + `importLegacyIdeas`.
- `src/lib/ranking.ts` — PURE logic (no DB/network/`Date.now()`): `winnerThreshold`
  (follower-aware, warm-up + trailing-10), `rankBriefing`, `pace`. Computed client-side in page.tsx.
- `src/lib/claude.ts` — `generateText({system,prompt})` over the Claude Agent SDK subscription
  (see Environment). Powers `/api/ideas/generate` + `/api/make-shootable`. Prompts are specific
  to @adam.jbrr — do not generalize.

**Routes** (all `runtime = 'nodejs'`, thin over repo): `ideas` (CRUD) · `ideas/generate` (Claude) ·
`make-shootable` (Claude → hook/captions, flips idea to shootable) · `posts` + `posts/[id]` ·
`follower-logs` · `backfill` (T5: paste recent posts → posted posts so ranking is warm day one).

**DB:** local Supabase via `npm run db:start` (Docker; Studio :54323, API :54321). Apply migrations
with `npm run db:reset` / `npm run migrate`. Local creds live in `.env.local` (gitignored).
**Start dev with `env -u SUPABASE_URL npm run dev`** (the shell's stray `SUPABASE_URL`).

**Styling:** Tailwind v4 — uses `@import "tailwindcss"` in `globals.css`, no `tailwind.config.ts`. Dark theme is forced via `color-scheme: dark` in CSS (not system-preference-dependent). Accent color is amber-500 (`#f59e0b`). Max content width is `max-w-2xl`. Mobile layout uses a fixed bottom nav bar; desktop shows the tab switcher in the header. Header tab buttons carry `aria-label={tab.label}` so they're findable on mobile where the text label is `hidden sm:inline`.

**tsconfig target:** `ES2020` (changed from scaffold default of ES2017).

---

## Testing

Two layers: **Vitest** unit tests for pure logic (`npm run test:unit` — ranking boundaries + repo mappers, no DB) and **Playwright** E2E (`npm run test` — `tests/app.spec.ts` mocks the GET routes via `page.route()`, asserts the three-tab shell + empty/error states; needs the dev server up).

```bash
# Dev server must be running first
npm run dev

# In another terminal
npm run test
```

Key test conventions:
- All element locators use `data-testid` attributes or scoped role queries (e.g. `locator('header').getByRole(...)`) — never bare `getByRole` that could match duplicates
- The `loc` helper object at the top of the test file centralises all selectors
- Clipboard tests skip on mobile (`isMobile` fixture) — `clipboard-write` is not available in WebKit device emulation

---

## Design System
Always read `DESIGN.md` before making any visual or UI decisions. All font choices, colors,
spacing, layout, and aesthetic direction are defined there (scoreboard direction, zinc-950 /
amber-500 / Geist, mobile single column + desktop two-pane, a11y rules). Do not deviate without
explicit user approval. In QA, flag any code that doesn't match DESIGN.md.
