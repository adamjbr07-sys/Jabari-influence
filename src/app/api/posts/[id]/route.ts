import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { updatePost } from '@/lib/repo'

export const runtime = 'nodejs'

// PATCH /api/posts/:id — mark posted / log views / set winner / etc.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const patch = await req.json()
    return ok({ post: await updatePost(id, patch) })
  } catch (err) {
    return fail(err)
  }
}
