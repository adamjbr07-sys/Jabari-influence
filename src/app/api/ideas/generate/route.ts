import { NextRequest } from 'next/server'
import { ok, fail } from '@/lib/api'
import { generateText, IDEAS_SYSTEM_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'

// POST /api/ideas/generate { lane?, situation? } -> { ideas: string[] }
// Claude generates a batch in @adam.jbrr's voice; the client picks which to save.
export async function POST(req: NextRequest) {
  try {
    const { lane, situation } = await req.json()
    const userMessage = [lane && `Lane: ${lane}`, situation?.trim() && `Today: ${situation}`]
      .filter(Boolean)
      .join('. ') || 'Any lane'

    const text = await generateText({ system: IDEAS_SYSTEM_PROMPT, prompt: userMessage })
    const ideas = text
      .split('\n')
      .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)

    return ok({ ideas })
  } catch (err) {
    return fail(err)
  }
}
