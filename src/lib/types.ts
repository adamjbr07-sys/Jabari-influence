// =============================================================================
// Content OS v2 — Schema + Ranking Contract (T0)
// =============================================================================
// This file is the FROZEN contract both build lanes import from (PLAN.md T0).
// Lane A (DB/repo/UI) and Lane B (ranking/vitest) must agree on these shapes.
// Change here = change the contract; keep CONTRACT.md in sync.
//
// Resolves the plan's status ambiguity: the single enum
// (idea|shootable|queued|posted) actually spans TWO lifecycles once ideas and
// posts are 1:many (D3). So:
//   - Idea lifecycle:  idea  -> shootable
//   - Post lifecycle:  queued -> posted
// An idea becomes "shootable" via make-shootable; queuing it to film creates one
// `posts` row per target platform (status queued), which becomes "posted" with
// metrics once published.
// =============================================================================

// ---- Enums / unions ---------------------------------------------------------

export type Platform = 'tiktok' | 'instagram'
export const PLATFORMS: Platform[] = ['tiktok', 'instagram']

/** Idea lifecycle. A raw/half idea, or a record-ready one (post-make-shootable). */
export type IdeaStatus = 'idea' | 'shootable'

/** Post lifecycle. Queued to film for one platform, or published with metrics. */
export type PostStatus = 'queued' | 'posted'

/**
 * Content lane. Optional + effectively free-text per design review (DR / Pass 4):
 * suggestions are offered but not enforced, so the taxonomy can flex.
 */
export type Lane = string
export const LANE_SUGGESTIONS = [
  'arab-muslim',
  'gym',
  'engineering',
  'vlogs',
] as const

// ---- Tables (D3) ------------------------------------------------------------

/**
 * `ideas` — the creative unit. Text + (after make-shootable) hook/caption/format.
 * One idea fans out to many `posts` (one per platform per publish).
 */
export interface Idea {
  id: string
  text: string
  status: IdeaStatus
  /** Populated by make-shootable: the on-screen POV hook + first line. */
  hook?: string
  caption?: string
  /** Free-form format note, e.g. "talking head", "green screen", "skit". */
  format?: string
  lane?: Lane
  /** D9: lightweight media field — link to the draft/footage (CapCut/Drive/Photos). */
  draftLink?: string
  /** Clone provenance (winner-loop): the idea this was generated from, if any. */
  sourceIdeaId?: string
  createdAt: number // epoch ms
}

/**
 * `posts` — one publish of an idea to one platform. Per-platform scoreboard lives
 * here (D3/D4). `views`/`postedAt`/`isWinner` are null until logged.
 */
export interface Post {
  id: string
  ideaId: string
  platform: Platform
  status: PostStatus
  /** Views logged at ~48h then refreshed ~7d (consistent window — PLAN premise 5). */
  views?: number
  postedAt?: number // epoch ms; set when status -> posted
  /** Optional guardrail metric (edit-time cap). Dropped if not logged, not assumed. */
  editMinutes?: number
  /**
   * D5 attribution: a DERIVED, best-effort candidate from the day's follower
   * delta on this post's publish day. NOT authoritative (follower_logs is).
   * Null when ambiguous (e.g. 2+ posts same day) or unknown.
   */
  followerDeltaCandidate?: number | null
  /** Computed by the winner loop (D5 follower-aware score >= threshold). */
  isWinner?: boolean
  createdAt: number // epoch ms
}

/**
 * `follower_logs` — daily follower count per platform. The AUTHORITATIVE source
 * for growth and the pace line (D3/D5). One row per (platform, date).
 */
export interface FollowerLog {
  id: string
  platform: Platform
  date: string // ISO date 'YYYY-MM-DD'
  count: number
}

// ---- Ranking constants (T3 may tune values; shape is frozen) ----------------

/** Winner threshold = WINNER_MULTIPLIER x trailing-median score, per platform. */
export const WINNER_MULTIPLIER = 2
/** Trailing window size for the median once enough data exists. */
export const WINNER_TRAILING_WINDOW = 10
/** Below this many posted samples, flag NO winners (too little signal). */
export const WINNER_MIN_SAMPLE = 3
/**
 * D5 follower-aware blend: score = views + (WINNER_FOLLOWER_WEIGHT * followerDeltaCandidate).
 * A follow is worth far more than a view; starting weight, T3 tunes against real data.
 */
export const WINNER_FOLLOWER_WEIGHT = 50

/** North-star (PLAN Success Criteria) — used only to compute the pace line. */
export const FOLLOWER_GOAL = 10_000
export const GOAL_DEADLINE = '2026-08-31' // ISO date
/** D7: default per-platform daily film target (configurable). */
export const DEFAULT_DAILY_TARGET = 2

// ---- Pure-function contracts (Lane B implements in src/lib/ranking.ts, T3) ---

/** The follower-aware score of a single post (views + weighted follower delta). */
export type PostScoreFn = (post: Post) => number

export interface WinnerThresholdInput {
  /** All posts (the function filters to `platform` + posted internally). */
  posts: Post[]
  platform: Platform
}
export interface WinnerThresholdResult {
  platform: Platform
  /** null during warm-up (fewer than WINNER_MIN_SAMPLE posted). */
  threshold: number | null
  isWarmup: boolean
  /** ids of posts whose score >= threshold. */
  winnerPostIds: string[]
}
export type WinnerThresholdFn = (
  input: WinnerThresholdInput,
) => WinnerThresholdResult

export type BriefingReason = 'winner-clone' | 'lane-rotation' | 'trend'
export interface BriefingPick {
  /** Existing shootable idea to film, when reason is winner-clone/lane-rotation. */
  ideaId?: string
  platform: Platform
  reason: BriefingReason
  /** Human-readable why-this-one (shown in the UI). */
  rationale: string
}
export interface RankBriefingInput {
  ideas: Idea[]
  posts: Post[]
  followerLogs: FollowerLog[]
  platform: Platform
  /** How many to surface for this platform (D7 target). */
  targetPerPlatform: number
}
export interface RankBriefingResult {
  platform: Platform
  picks: BriefingPick[]
  /** true when there's not enough winner data yet -> lane rotation + trends fallback. */
  coldStart: boolean
}
export type RankBriefingFn = (input: RankBriefingInput) => RankBriefingResult

export interface PaceInput {
  followerLogs: FollowerLog[]
  platform: Platform
  goal: number // FOLLOWER_GOAL
  deadline: string // GOAL_DEADLINE (ISO date)
  today: string // ISO date — injected (no Date.now() in pure logic, for testability)
}
export interface PaceResult {
  platform: Platform
  current: number
  /** goal - current. */
  remaining: number
  /** follows/day needed from `today` to hit goal by deadline. */
  perDayRequired: number
  /**
   * + = ahead of the straight-line pace, - = behind. Framed in UI as
   * "X to go today", not a bare red number (design review Pass 3).
   */
  aheadBehind: number
}
export type PaceFn = (input: PaceInput) => PaceResult

// =============================================================================
// Legacy (pre-v2) — still used by the current IdeaGenerator/HookGenerator until
// Lane A (T2) migrates them onto the Idea/Post repo. Do not extend; remove in T2.
// =============================================================================

export type Category =
  | 'gym'
  | 'muslim-arab'
  | 'engineering'
  | 'canadian'
  | 'arab-canadian'

export interface ContentIdea {
  id: string
  text: string
  category: Category
  createdAt: number
}

export interface HookOutput {
  hookText: string
  tiktokCaption: string
  igCaption: string
}
