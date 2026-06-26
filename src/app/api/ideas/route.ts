import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL, IDEAS_SYSTEM_PROMPT } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { category, situation } = await req.json()

    const userMessage = situation?.trim()
      ? `Category: ${category}. Situation/mood today: ${situation}`
      : `Category: ${category}`

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: IDEAS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ ideas: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
