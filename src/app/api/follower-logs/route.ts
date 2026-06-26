import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { listFollowerLogs, upsertFollowerLog } from '@/lib/repo'
import type { Platform } from '@/lib/types'

export const runtime = 'nodejs'

// GET /api/follower-logs?platform=tiktok
export async function GET(req: NextRequest) {
  try {
    const platform = req.nextUrl.searchParams.get('platform') as Platform | null
    return ok({ logs: await listFollowerLogs(platform ?? undefined) })
  } catch (err) {
    return fail(err)
  }
}

// POST /api/follower-logs { platform, date, count } — upsert one day's count
export async function POST(req: NextRequest) {
  try {
    const { platform, date, count } = await req.json()
    if (!platform || !date || typeof count !== 'number')
      return fail(new Error('platform, date, count required'), 400)
    return ok({ log: await upsertFollowerLog(platform, date, count) })
  } catch (err) {
    return fail(err)
  }
}
