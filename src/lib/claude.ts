import { query } from '@anthropic-ai/claude-agent-sdk'

export const MODEL = 'claude-sonnet-4-6'

export const IDEAS_SYSTEM_PROMPT = `You are a content idea generator for @adam.jbrr, a Muslim Arab mechanical engineering student in Toronto, Canada. His content formula is: POV: [hyper-relatable scenario] + [Muslim/Arab/student/gym identity] + [comedic or emotional payoff]. His top posts get 100K–400K+ views. His audience is 18–34 male on Instagram, 50/50 on TikTok. Generate 10 content ideas in his exact voice — specific, relatable, never generic. Always use POV: format unless using How every [X] be like: format. Return as a numbered list, ideas only, no explanation.`

export const HOOK_SYSTEM_PROMPT = `You are a social media content writer for @adam.jbrr, a Muslim Arab mechanical engineering student in Toronto, Canada. His voice is casual, self-aware, and funny — never corporate or generic.

Given a content idea, generate three things:

1. ON-SCREEN HOOK TEXT: The exact POV: text that appears on screen in the first 1-2 seconds. Short, punchy, specific. No emojis.
2. TIKTOK CAPTION: Max 150 characters total including hashtags. 5-8 hashtags. Mix niche (#engineeringstudent #muslimstudent #arabcanadian #guelph) with broad (#fyp #university #gym). Casual tone, can use emojis.
3. INSTAGRAM CAPTION: 1-2 sentences + 3-5 hashtags. Slightly more personality than TikTok, same casual voice.

Return in EXACTLY this format with no extra text before or after:
HOOK: [hook text here]
TIKTOK: [caption + hashtags here]
INSTAGRAM: [caption + hashtags here]`

export const CLONE_SYSTEM_PROMPT = `You are generating follow-ups to a video that worked for @adam.jbrr, a Muslim Arab mechanical engineering student in Toronto. Given one idea that performed well, produce 3 genuinely DIFFERENT variations that keep what made it land but change at least one of: the angle, the audience, the scenario, the opening line, or the payoff. Do NOT just reword the original or swap a noun — each must feel like a NEW video someone would stop to watch, not a near-duplicate (avoid audience fatigue). Stay in his voice and his POV:/How every [X] be like: formats. Return a numbered list, ideas only, exactly 3 lines, no explanation.`

/**
 * Thrown when the Claude subscription isn't connected on the host. The route
 * handlers surface its message to the client so the UI can show setup steps.
 */
export class ClaudeAuthError extends Error {
  constructor() {
    super(
      'Claude subscription not connected. On the host, run "claude setup-token" and set CLAUDE_CODE_OAUTH_TOKEN, or run "claude /login".',
    )
    this.name = 'ClaudeAuthError'
  }
}

/**
 * Run a single-shot, no-tools generation through the Claude Agent SDK. This uses
 * the host's Claude *subscription* (Claude Code OAuth) rather than ANTHROPIC_API_KEY
 * per-token billing: auth resolves from CLAUDE_CODE_OAUTH_TOKEN if set, otherwise
 * the logged-in `claude /login` session. The SDK spawns the `claude` CLI, so this
 * only runs on a Node host with the CLI installed (not Edge/serverless).
 */
export async function generateText({
  system,
  prompt,
}: {
  system: string
  prompt: string
}): Promise<string> {
  const response = query({
    prompt,
    options: {
      model: MODEL,
      systemPrompt: system,
      maxTurns: 1,
      // Plain text generation only — no tools, no local CLAUDE.md/settings, no file I/O.
      allowedTools: [],
      settingSources: [],
      permissionMode: 'bypassPermissions',
      cwd: '/tmp',
    },
  })

  for await (const message of response) {
    if (message.type === 'result') {
      if (message.subtype === 'success') return message.result.trim()
      throw new Error(`Claude run did not complete (${message.subtype}).`)
    }
  }

  throw new Error('Claude returned no result.')
}
