import { describe, it, expect } from 'vitest'
import { postScore, median, winnerThreshold, rankBriefing, pace } from './ranking'
import { WINNER_FOLLOWER_WEIGHT, type Post, type Idea, type FollowerLog } from './types'

// --- helpers ---
let seq = 0
function post(p: Partial<Post> = {}): Post {
  seq += 1
  return {
    id: p.id ?? `p${seq}`,
    ideaId: p.ideaId ?? `i${seq}`,
    platform: p.platform ?? 'tiktok',
    status: p.status ?? 'posted',
    views: p.views,
    postedAt: p.postedAt ?? seq, // monotonic by default
    followerDeltaCandidate: p.followerDeltaCandidate,
    isWinner: p.isWinner,
    createdAt: p.createdAt ?? seq,
  }
}
function idea(p: Partial<Idea> = {}): Idea {
  seq += 1
  return {
    id: p.id ?? `idea${seq}`,
    text: p.text ?? `idea ${seq}`,
    status: p.status ?? 'shootable',
    lane: p.lane,
    sourceIdeaId: p.sourceIdeaId,
    createdAt: p.createdAt ?? seq,
  }
}

describe('median', () => {
  it('odd / even / empty', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})

describe('postScore (follower-aware, D5)', () => {
  it('blends views + weighted follower delta', () => {
    expect(postScore(post({ views: 100, followerDeltaCandidate: 2 }))).toBe(
      100 + WINNER_FOLLOWER_WEIGHT * 2,
    )
  })
  it('treats missing/null as 0', () => {
    expect(postScore(post({ views: undefined, followerDeltaCandidate: null }))).toBe(0)
  })
})

describe('winnerThreshold warm-up', () => {
  it('N < 3 -> no winners, null threshold, warmup', () => {
    const r = winnerThreshold({ posts: [post({ views: 9999 }), post({ views: 1 })], platform: 'tiktok' })
    expect(r.threshold).toBeNull()
    expect(r.isWarmup).toBe(true)
    expect(r.winnerPostIds).toEqual([])
  })

  it('3 <= N < 10 -> 2x median of N, winners flagged, still warmup', () => {
    const posts = [post({ views: 100 }), post({ views: 100 }), post({ id: 'big', views: 1000 })]
    const r = winnerThreshold({ posts, platform: 'tiktok' })
    expect(r.threshold).toBe(200) // 2 * median(100,100,1000)=2*100
    expect(r.isWarmup).toBe(true)
    expect(r.winnerPostIds).toEqual(['big'])
  })

  it('only counts posted posts for this platform', () => {
    const posts = [
      post({ views: 100, status: 'queued' }), // ignored (queued)
      post({ views: 100, platform: 'instagram' }), // ignored (other platform)
      post({ views: 100 }),
      post({ views: 100 }),
    ]
    const r = winnerThreshold({ posts, platform: 'tiktok' })
    expect(r.threshold).toBeNull() // only 2 valid -> warmup
  })
})

describe('winnerThreshold follower-aware (D5 over pure views)', () => {
  it('same views, higher follower delta wins', () => {
    const posts = [
      post({ id: 'a', views: 100 }),
      post({ id: 'b', views: 100 }),
      post({ id: 'c', views: 100 }),
      post({ id: 'd', views: 100 }),
      post({ id: 'win', views: 100, followerDeltaCandidate: 40 }), // +2000 score
    ]
    const r = winnerThreshold({ posts, platform: 'tiktok' })
    // median score = 100 -> threshold 200; only 'win' (score 2100) clears it
    expect(r.winnerPostIds).toEqual(['win'])
  })
})

describe('winnerThreshold trailing-10 window', () => {
  it('threshold uses only the 10 most-recent posted posts', () => {
    const recent = Array.from({ length: 10 }, (_, k) =>
      post({ id: `r${k}`, views: (k + 1) * 10, postedAt: 1000 + k }), // 10..100, recent
    )
    const old = Array.from({ length: 5 }, (_, k) =>
      post({ id: `o${k}`, views: 1000, postedAt: k }), // older, big
    )
    const r = winnerThreshold({ posts: [...old, ...recent], platform: 'tiktok' })
    // trailing 10 = the 10..100 set; median 55 -> threshold 110.
    // If the old 1000s leaked into the window, median would be 80 -> 160.
    expect(r.threshold).toBe(110)
    expect(r.isWarmup).toBe(false) // N=15
    // winners = score >= 110 -> the 5 old 1000s only
    expect(r.winnerPostIds.sort()).toEqual(['o0', 'o1', 'o2', 'o3', 'o4'])
  })
})

describe('rankBriefing', () => {
  it('cold start (no winners) -> coldStart true, lane rotation, capped to target', () => {
    const ideas = [idea({ lane: 'gym' }), idea({ lane: 'vlogs' }), idea({ lane: 'engineering' })]
    const r = rankBriefing({ ideas, posts: [], followerLogs: [], platform: 'tiktok', targetPerPlatform: 2 })
    expect(r.coldStart).toBe(true)
    expect(r.picks).toHaveLength(2)
    expect(r.picks.every((p) => p.reason === 'lane-rotation')).toBe(true)
  })

  it('with a winning lane -> winner-clone pick for a shootable idea in that lane', () => {
    const gymIdea = idea({ id: 'gym-src', lane: 'gym' })
    const shootGym = idea({ id: 'shoot-gym', lane: 'gym' })
    // 3 posted on tiktok; the gym one is a runaway winner
    const posts = [
      post({ id: 'pg', ideaId: 'gym-src', views: 5000 }),
      post({ views: 100 }),
      post({ views: 100 }),
    ]
    const r = rankBriefing({
      ideas: [gymIdea, shootGym],
      posts,
      followerLogs: [],
      platform: 'tiktok',
      targetPerPlatform: 1,
    })
    expect(r.coldStart).toBe(false)
    expect(r.picks[0]).toMatchObject({ ideaId: 'shoot-gym', reason: 'winner-clone' })
  })

  it('empty bank -> fills with trend picks', () => {
    const r = rankBriefing({ ideas: [], posts: [], followerLogs: [], platform: 'instagram', targetPerPlatform: 2 })
    expect(r.picks).toHaveLength(2)
    expect(r.picks.every((p) => p.reason === 'trend')).toBe(true)
  })
})

describe('pace', () => {
  const logs: FollowerLog[] = [
    { id: 'l1', platform: 'tiktok', date: '2026-06-01', count: 1000 },
    { id: 'l2', platform: 'tiktok', date: '2026-06-26', count: 1650 },
  ]
  it('computes current, remaining, per-day-required', () => {
    const r = pace({ followerLogs: logs, platform: 'tiktok', goal: 10_000, deadline: '2026-08-31', today: '2026-06-26' })
    expect(r.current).toBe(1650)
    expect(r.remaining).toBe(8350)
    expect(r.perDayRequired).toBe(127) // ceil(8350 / 66 days)
    expect(r.aheadBehind).toBeLessThan(0) // behind the straight line
  })
  it('single log -> aheadBehind 0 (no trend yet)', () => {
    const r = pace({
      followerLogs: [logs[1]],
      platform: 'tiktok',
      goal: 10_000,
      deadline: '2026-08-31',
      today: '2026-06-26',
    })
    expect(r.aheadBehind).toBe(0)
    expect(r.current).toBe(1650)
  })
})
