import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { updateIdea } from '@/lib/repo'

export const runtime = 'nodejs'

// PATCH /api/ideas/:id — update an idea (draft link, lane, status, hook, …)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const patch = await req.json()
    return ok({ idea: await updateIdea(id, patch) })
  } catch (err) {
    return fail(err)
  }
}
