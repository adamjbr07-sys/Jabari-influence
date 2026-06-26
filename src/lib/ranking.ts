// =============================================================================
// Content OS v2 — Ranking & pace (Lane B, T3)
// =============================================================================
// Pure functions implementing the contract in src/lib/types.ts / CONTRACT.md.
// NO DB, NO network, NO Date.now() — every time input is passed in, so T4 (Vitest)
// can pin boundaries (N=2/3/10, cold start, pace dates). DB/network live in the
// repo layer (T2).
// =============================================================================

import {
  type Post,
  type Platform,
  type Idea,
  type WinnerThresholdInput,
  type WinnerThresholdResult,
  type RankBriefingInput,
  type RankBriefingResult,
  type BriefingPick,
  type PaceInput,
  type PaceResult,
  WINNER_MULTIPLIER,
  WINNER_TRAILING_WINDOW,
  WINNER_MIN_SAMPLE,
  WINNER_FOLLOWER_WEIGHT,
} from './types'

// ---- helpers ----------------------------------------------------------------

/** Follower-aware score (D5): views + weighted follower-delta candidate. */
export function postScore(post: Post): number {
  return (post.views ?? 0) + WINNER_FOLLOWER_WEIGHT * (post.followerDeltaCandidate ?? 0)
}

/** Median of a numeric array. Returns 0 for empty (callers guard via sample size). */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Posted posts for one platform, most-recent first (by postedAt, then id). */
function postedFor(posts: Post[], platform: Platform): Post[] {
  return posts
    .filter((p) => p.platform === platform && p.status === 'posted')
    .sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0) || (a.id < b.id ? 1 : -1))
}

/** ISO 'YYYY-MM-DD' -> integer day number (UTC). Deterministic; no `now`. */
function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

// ---- winner threshold (D5) --------------------------------------------------

export const winnerThreshold = (input: WinnerThresholdInput): WinnerThresholdResult => {
  const { platform } = input
  const posted = postedFor(input.posts, platform)
  const n = posted.length

  if (n < WINNER_MIN_SAMPLE) {
    return { platform, threshold: null, isWarmup: true, winnerPostIds: [] }
  }

  // Trailing window: most recent WINNER_TRAILING_WINDOW posts (all of them if 3..9).
  const trailing = posted.slice(0, Math.min(n, WINNER_TRAILING_WINDOW))
  const threshold = WINNER_MULTIPLIER * median(trailing.map(postScore))
  const winnerPostIds = posted.filter((p) => postScore(p) >= threshold).map((p) => p.id)

  return {
    platform,
    threshold,
    isWarmup: n < WINNER_TRAILING_WINDOW,
    winnerPostIds,
  }
}

// ---- briefing ranking (T3 logic; T8 calls) ----------------------------------

export const rankBriefing = (input: RankBriefingInput): RankBriefingResult => {
  const { ideas, posts, platform, targetPerPlatform } = input

  const { winnerPostIds } = winnerThreshold({ posts, platform })
  const shootable = ideas.filter((i) => i.status === 'shootable')

  // Lanes of the winning posts' source ideas — what to clone toward.
  const ideaById = new Map(ideas.map((i) => [i.id, i]))
  const winnerLanes = new Set(
    posts
      .filter((p) => winnerPostIds.includes(p.id))
      .map((p) => ideaById.get(p.ideaId)?.lane)
      .filter((l): l is string => Boolean(l)),
  )

  const coldStart = winnerPostIds.length === 0

  const picks: BriefingPick[] = []
  const used = new Set<string>()

  // 1. Winner-clone: shootable ideas whose lane matches a winning lane.
  if (!coldStart) {
    for (const idea of shootable) {
      if (picks.length >= targetPerPlatform) break
      if (idea.lane && winnerLanes.has(idea.lane)) {
        picks.push({
          ideaId: idea.id,
          platform,
          reason: 'winner-clone',
          rationale: `Lane "${idea.lane}" is winning on ${platform} — make more like it.`,
        })
        used.add(idea.id)
      }
    }
  }

  // 2. Lane rotation: fill remaining slots from the rest of the shootable bank,
  //    rotating lanes so we don't stack the same lane.
  const seenLanes = new Set<string>()
  for (const idea of shootable) {
    if (picks.length >= targetPerPlatform) break
    if (used.has(idea.id)) continue
    const lane = idea.lane ?? '_none'
    if (seenLanes.has(lane)) continue
    seenLanes.add(lane)
    picks.push({
      ideaId: idea.id,
      platform,
      reason: 'lane-rotation',
      rationale: coldStart
        ? `Warming up — rotating lane "${idea.lane ?? 'unlabeled'}".`
        : `Rotating in lane "${idea.lane ?? 'unlabeled'}" for spread.`,
    })
    used.add(idea.id)
  }

  // 3. Still short (e.g. empty/thin bank) -> signal the caller to pull trends.
  while (picks.length < targetPerPlatform) {
    picks.push({
      platform,
      reason: 'trend',
      rationale: 'Bank is thin — pull a trending topic to seed a new idea.',
    })
  }

  return { platform, picks, coldStart }
}

// ---- pace line (T9 UI consumes) ---------------------------------------------

export const pace = (input: PaceInput): PaceResult => {
  const { followerLogs, platform, goal, deadline, today } = input
  const logs = followerLogs
    .filter((l) => l.platform === platform)
    .sort((a, b) => dayNumber(a.date) - dayNumber(b.date))

  const current = logs.length ? logs[logs.length - 1].count : 0
  const remaining = Math.max(0, goal - current)

  const todayN = dayNumber(today)
  const deadlineN = dayNumber(deadline)
  const daysLeft = Math.max(1, deadlineN - todayN)
  const perDayRequired = Math.ceil(remaining / daysLeft)

  // Ahead/behind vs the straight line from the first logged point to the goal.
  let aheadBehind = 0
  if (logs.length >= 2) {
    const startN = dayNumber(logs[0].date)
    const startCount = logs[0].count
    const total = Math.max(1, deadlineN - startN)
    const elapsed = Math.min(Math.max(0, todayN - startN), total)
    const expectedNow = startCount + (goal - startCount) * (elapsed / total)
    aheadBehind = Math.round(current - expectedNow)
  }

  return { platform, current, remaining, perDayRequired, aheadBehind }
}
