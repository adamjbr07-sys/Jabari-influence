import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL, HOOK_SYSTEM_PROMPT } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json()

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: HOOK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: idea }],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text : ''

    function extractSection(raw: string, start: string, end?: string): string {
      const si = raw.indexOf(start)
      if (si === -1) return ''
      const after = raw.slice(si + start.length)
      if (!end) return after.trim()
      const ei = after.indexOf(end)
      return (ei === -1 ? after : after.slice(0, ei)).trim()
    }

    return NextResponse.json({
      hookText: extractSection(text, 'HOOK:', 'TIKTOK:'),
      tiktokCaption: extractSection(text, 'TIKTOK:', 'INSTAGRAM:'),
      igCaption: extractSection(text, 'INSTAGRAM:'),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
