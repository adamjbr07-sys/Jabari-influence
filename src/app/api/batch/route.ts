import { ok, fail } from '@/lib/api'
import { listIdeas, listPosts, listFollowerLogs, createPost, createIdea } from '@/lib/repo'
import { rankBriefing } from '@/lib/ranking'
import { generateText, IDEAS_SYSTEM_PROMPT } from '@/lib/claude'
import { PLATFORMS, DEFAULT_DAILY_TARGET } from '@/lib/types'

export const runtime = 'nodejs'

// POST /api/batch  (T8 — "generate tomorrow's batch", button-driven not cron, D6)
// Per platform: rank the bank against recent winners (rankBriefing), queue the
// picks. Cold/thin slots ('trend') generate a fresh shootable idea via Claude.
// Returns what it queued so the Today tab fills with content to film.
export async function POST() {
  try {
    const [ideas, posts, logs] = await Promise.all([listIdeas(), listPosts(), listFollowerLogs()])

    let queued = 0
    let generated = 0
    const picks: { platform: string; reason: string; rationale: string }[] = []

    for (const platform of PLATFORMS) {
      const briefing = rankBriefing({
        ideas,
        posts,
        followerLogs: logs,
        platform,
        targetPerPlatform: DEFAULT_DAILY_TARGET,
      })
      const alreadyQueued = new Set(
        posts.filter((p) => p.platform === platform && p.status === 'queued').map((p) => p.ideaId),
      )

      for (const pick of briefing.picks) {
        let ideaId = pick.ideaId
        if (!ideaId) {
          // trend slot: generate one fresh idea in his voice
          const text = (await generateText({ system: IDEAS_SYSTEM_PROMPT, prompt: 'Give one fresh idea.' }))
            .split('\n')
            .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
            .filter(Boolean)[0]
          if (!text) continue
          const idea = await createIdea({ text, hook: text, status: 'shootable' })
          ideaId = idea.id
          generated += 1
        }
        if (alreadyQueued.has(ideaId)) continue
        await createPost({ ideaId, platform, status: 'queued' })
        alreadyQueued.add(ideaId)
        queued += 1
        picks.push({ platform, reason: pick.reason, rationale: pick.rationale })
      }
    }

    return ok({ queued, generated, picks })
  } catch (err) {
    return fail(err)
  }
}
