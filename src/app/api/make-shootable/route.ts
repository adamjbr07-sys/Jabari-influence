import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { generateText, HOOK_SYSTEM_PROMPT } from '@/lib/claude'
import { updateIdea } from '@/lib/repo'

export const runtime = 'nodejs'

function section(raw: string, start: string, end?: string): string {
  const si = raw.indexOf(start)
  if (si === -1) return ''
  const after = raw.slice(si + start.length)
  if (!end) return after.trim()
  const ei = after.indexOf(end)
  return (ei === -1 ? after : after.slice(0, ei)).trim()
}

// POST /api/make-shootable { ideaId, text } -> turns a half-idea into a
// record-ready hook + captions and flips the idea to `shootable` (the core
// conversion step, T6). Runs on the Claude subscription.
export async function POST(req: NextRequest) {
  try {
    const { ideaId, text } = await req.json()
    if (!ideaId || !text?.trim()) return fail(new Error('ideaId and text required'), 400)

    const out = await generateText({ system: HOOK_SYSTEM_PROMPT, prompt: text })
    const hook = section(out, 'HOOK:', 'TIKTOK:')
    const tiktok = section(out, 'TIKTOK:', 'INSTAGRAM:')
    const ig = section(out, 'INSTAGRAM:')
    const caption = [tiktok && `TikTok: ${tiktok}`, ig && `IG: ${ig}`].filter(Boolean).join('\n')

    const idea = await updateIdea(ideaId, {
      status: 'shootable',
      hook: hook || text,
      caption,
    })
    return ok({ idea })
  } catch (err) {
    return fail(err)
  }
}
