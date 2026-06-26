import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { listIdeas, createIdea } from '@/lib/repo'
import type { IdeaStatus } from '@/lib/types'

export const runtime = 'nodejs'

// GET /api/ideas?status=shootable — list ideas (newest first)
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') as IdeaStatus | null
    return ok({ ideas: await listIdeas(status ?? undefined) })
  } catch (err) {
    return fail(err)
  }
}

// POST /api/ideas — create one idea { text, lane?, status? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.text?.trim()) return fail(new Error('text is required'), 400)
    return ok({ idea: await createIdea({ text: body.text, lane: body.lane, status: body.status }) })
  } catch (err) {
    return fail(err)
  }
}
