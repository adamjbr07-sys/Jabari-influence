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

## Architecture

Single-page app with two tabs. State lives in `src/app/page.tsx` (a client component), which owns the `activeTab` and `pendingIdea` state. When the user clicks "Use this →" in the Ideas tab, `pendingIdea` is set and the Captions tab is activated — `HookGenerator` receives `initialIdea` as a prop and re-mounts on change via `key={pendingIdea}`.

**Data flow:**
```
page.tsx (client, owns tab + pendingIdea state)
  ├── IdeaGenerator  → POST /api/ideas  → Claude API → returns numbered list
  └── HookGenerator  → POST /api/hook   → Claude API → returns HOOK:/TIKTOK:/INSTAGRAM: block
```

**Persistence:** `src/lib/storage.ts` wraps `localStorage` under key `cos_ideas`. Only saved ideas persist — generated ideas and captions are ephemeral. Deduplication is by **text content** (not id), so saving the same idea text twice is a no-op.

**Claude layer:** `src/lib/claude.ts` exports the model constant (`claude-sonnet-4-6`), both system prompts, and `generateText({system, prompt})` — a single-shot, no-tools wrapper around the Claude Agent SDK's `query()` that returns the final assistant text. It runs on the host's Claude subscription (see Environment), with `allowedTools: []`, `settingSources: []` (no local CLAUDE.md/settings), and `cwd: '/tmp'` (no project file I/O). All AI calls are server-side only (route handlers). The system prompts are highly specific to @adam.jbrr's content formula — do not generalize them.

**Hook parsing:** `/api/hook/route.ts` parses Claude's response by searching for literal strings `HOOK:`, `TIKTOK:`, `INSTAGRAM:` using `indexOf`. The system prompt enforces this exact format. If parsing produces empty strings, check whether Claude deviated from the format.

**Styling:** Tailwind v4 — uses `@import "tailwindcss"` in `globals.css`, no `tailwind.config.ts`. Dark theme is forced via `color-scheme: dark` in CSS (not system-preference-dependent). Accent color is amber-500 (`#f59e0b`). Max content width is `max-w-2xl`. Mobile layout uses a fixed bottom nav bar; desktop shows the tab switcher in the header. Header tab buttons carry `aria-label={tab.label}` so they're findable on mobile where the text label is `hidden sm:inline`.

**tsconfig target:** `ES2020` (changed from scaffold default of ES2017).

---

## Testing

Playwright E2E suite at `tests/app.spec.ts`. All Claude calls are mocked via `page.route()` on `/api/ideas` and `/api/hook` — tests run without a Claude subscription or any real generation.

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
