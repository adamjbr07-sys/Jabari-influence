# Content OS v2 — Build Contract (T0)

Frozen agreement both build lanes implement against. Types live in
`src/lib/types.ts`; this file is the prose: semantics, invariants, and the math
that the types can't express. If you change one, change the other.

See `PLAN.md` for the task list (T0-T12) and decisions (D1-D9), `DESIGN.md` for
the visual system.

## Tables (D3)

```
ideas (1) ───< posts (many)            follower_logs (per platform per day)
  one creative unit       one publish to one platform     authoritative growth
```

- **ideas** — text + (after make-shootable) hook/caption/format/lane/draftLink.
  Status `idea | shootable`. `sourceIdeaId` links a clone to the winner it came from.
- **posts** — one idea published to one platform. Status `queued | posted`. Carries
  `views`, `postedAt`, `editMinutes`, `followerDeltaCandidate`, `isWinner`.
- **follower_logs** — `(platform, date, count)`, one row per platform per day.
  **Authoritative** for growth and the pace line.

## Status lifecycles (resolves the plan's single-enum ambiguity)

```
idea:  idea ──make-shootable──> shootable
post:  (queue to film) ──> queued ──publish+log──> posted
```

Queuing a shootable idea creates one `posts` row per target platform (status
`queued`). One film can become two posts (cross-post, D7).

## Follower attribution (D5) — the one subtle invariant

- `follower_logs` is the **only** source of truth for follower counts.
- `posts.followerDeltaCandidate` is **derived and best-effort**: the day's follower
  delta (from follower_logs) attributed to a post published that day.
- When 2+ posts publish on the same day, the delta is **ambiguous** — set
  `followerDeltaCandidate = null` (a "candidate", surfaced in UI as uncertain),
  do NOT split or guess. Never treat a candidate as authoritative.

## Winner score + threshold (D5, T3 implements)

Per platform, over **posted** posts only:

```
score(post)      = (post.views ?? 0) + WINNER_FOLLOWER_WEIGHT * (post.followerDeltaCandidate ?? 0)
threshold        = WINNER_MULTIPLIER * median(trailing scores)
isWinner(post)   = score(post) >= threshold
```

Trailing window + warm-up:

| posted count N (this platform) | threshold basis |
|---|---|
| N < WINNER_MIN_SAMPLE (3) | none — flag NO winners (too little signal) |
| 3 <= N < WINNER_TRAILING_WINDOW (10) | 2x median of the N available |
| N >= 10 | 2x median of the trailing 10 |

`followerDeltaCandidate` (D5) is why score is follower-aware, not pure views —
we optimize follows (the goal), not views (the proxy). Constants in types.ts are
starting values; T3 may tune `WINNER_FOLLOWER_WEIGHT` against real backfilled data.

## Briefing ranking (T3 implements, T8 calls)

`rankBriefing` surfaces `targetPerPlatform` (D7 default 2) picks per platform:

1. **Has winner data** → rank shootable ideas by similarity to recent winners
   (`reason: 'winner-clone'`), fill remaining slots by lane rotation.
2. **Cold start** (no winners yet, e.g. first ~2 weeks, or before backfill) →
   `coldStart: true`, fall back to lane rotation + the trends route. Backfill (D8,
   T5) is what makes day-one winner data exist, skipping most of this.

## Pace line (T9 UI)

`pace()` computes, per platform, follows/day required from `today` to hit
`FOLLOWER_GOAL` by `GOAL_DEADLINE`, and an `aheadBehind` delta. UI frames it as
"X to go today", not a bare red number (design review Pass 3). Red only when
meaningfully off pace.

## Purity / testability rule

The ranking/pace functions are **pure** and take `today`/timestamps as inputs —
no `Date.now()` inside (so Vitest, T4, can pin boundaries: N=2, N=3, N=10, cold
start). DB access and network stay in the repo layer (T2), never in `ranking.ts`.

## Lane split (build order, PLAN parallelization)

- **Lane A** (db/repo/ui): T1 schema → T2 repo → T5 backfill / T6 pipeline → T7/T8/T9/T11.
- **Lane B** (pure logic): T3 ranking → T4 vitest. Imports types only; no DB.

Both import from `src/lib/types.ts`. That shared import is the whole point of T0.
