import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { createIdea, createPost } from '@/lib/repo'
import type { Platform } from '@/lib/types'

export const runtime = 'nodejs'

interface BackfillRow {
  text: string
  platform: Platform
  date: string // 'YYYY-MM-DD' (publish day)
  views?: number
  lane?: string
  followerDelta?: number
}

// POST /api/backfill { rows: BackfillRow[] }  (T5)
// Each row -> a shootable idea + one POSTED post (views/postedAt/followerDelta),
// so winnerThreshold + the pace line have real history immediately (D8). No cold
// start. Skips rows missing text/platform/date.
export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: BackfillRow[] }
    if (!Array.isArray(rows) || rows.length === 0) return fail(new Error('rows required'), 400)

    let created = 0
    const errors: string[] = []
    for (const [i, r] of rows.entries()) {
      if (!r?.text?.trim() || !r?.platform || !r?.date) {
        errors.push(`row ${i + 1}: missing text/platform/date`)
        continue
      }
      const idea = await createIdea({ text: r.text, lane: r.lane, status: 'shootable' })
      await createPost({
        ideaId: idea.id,
        platform: r.platform,
        status: 'posted',
        views: typeof r.views === 'number' ? r.views : undefined,
        postedAt: Date.parse(`${r.date}T12:00:00Z`),
        followerDeltaCandidate: typeof r.followerDelta === 'number' ? r.followerDelta : undefined,
      })
      created += 1
    }
    return ok({ created, skipped: errors })
  } catch (err) {
    return fail(err)
  }
}
