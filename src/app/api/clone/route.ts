import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { generateText, CLONE_SYSTEM_PROMPT } from '@/lib/claude'
import { createIdea } from '@/lib/repo'

export const runtime = 'nodejs'

// POST /api/clone { ideaId, text, lane? }  (T7 winner-loop)
// "Make 3 more like this": Claude produces 3 constrained variations of a winner;
// each lands as a `shootable` idea linked to the source via sourceIdeaId.
export async function POST(req: NextRequest) {
  try {
    const { ideaId, text, lane } = await req.json()
    if (!ideaId || !text?.trim()) return fail(new Error('ideaId and text required'), 400)

    const out = await generateText({ system: CLONE_SYSTEM_PROMPT, prompt: text })
    const variations = out
      .split('\n')
      .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3)

    const clones = []
    for (const v of variations) {
      clones.push(
        await createIdea({ text: v, hook: v, status: 'shootable', lane, sourceIdeaId: ideaId }),
      )
    }
    return ok({ clones })
  } catch (err) {
    return fail(err)
  }
}
