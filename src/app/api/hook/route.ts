import { NextRequest, NextResponse } from 'next/server'
import { generateText, HOOK_SYSTEM_PROMPT } from '@/lib/claude'

// Subscription auth spawns the `claude` CLI subprocess — requires the Node.js runtime.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json()

    const text = await generateText({
      system: HOOK_SYSTEM_PROMPT,
      prompt: idea,
    })

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
