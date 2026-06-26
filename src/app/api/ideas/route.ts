import { NextRequest, NextResponse } from 'next/server'
import { generateText, IDEAS_SYSTEM_PROMPT } from '@/lib/claude'

// Subscription auth spawns the `claude` CLI subprocess — requires the Node.js runtime.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { category, situation } = await req.json()

    const userMessage = situation?.trim()
      ? `Category: ${category}. Situation/mood today: ${situation}`
      : `Category: ${category}`

    const ideas = await generateText({
      system: IDEAS_SYSTEM_PROMPT,
      prompt: userMessage,
    })

    return NextResponse.json({ ideas })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
