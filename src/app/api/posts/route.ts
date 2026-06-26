import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { listPosts, createPost } from '@/lib/repo'
import type { Platform, PostStatus } from '@/lib/types'

export const runtime = 'nodejs'

// GET /api/posts?platform=tiktok&status=posted
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    return ok({
      posts: await listPosts({
        platform: (sp.get('platform') as Platform) ?? undefined,
        status: (sp.get('status') as PostStatus) ?? undefined,
      }),
    })
  } catch (err) {
    return fail(err)
  }
}

// POST /api/posts { ideaId, platform, status? } — queue an idea to film (per platform)
export async function POST(req: NextRequest) {
  try {
    const { ideaId, platform, status } = await req.json()
    if (!ideaId || !platform) return fail(new Error('ideaId and platform required'), 400)
    return ok({ post: await createPost({ ideaId, platform, status }) })
  } catch (err) {
    return fail(err)
  }
}
