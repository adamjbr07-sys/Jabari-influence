'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  PLATFORMS,
  FOLLOWER_GOAL,
  GOAL_DEADLINE,
  type Idea,
  type Post,
  type FollowerLog,
  type Platform,
} from '@/lib/types'
import { winnerThreshold, pace } from '@/lib/ranking'

type Tab = 'today' | 'bank' | 'results'
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'bank', label: 'Bank' },
  { id: 'results', label: 'Results' },
]
const PLATFORM_LABEL: Record<Platform, string> = { tiktok: 'TikTok', instagram: 'Instagram' }

async function getJSON(url: string) {
  const r = await fetch(url)
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Request failed')
  return d
}
async function send(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Request failed')
  return d
}

export default function Page() {
  const [tab, setTab] = useState<Tab>('today')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [logs, setLogs] = useState<FollowerLog[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [today, setToday] = useState('')

  const load = useCallback(async () => {
    try {
      setError('')
      const [a, b, c] = await Promise.all([
        getJSON('/api/ideas'),
        getJSON('/api/posts'),
        getJSON('/api/follower-logs'),
      ])
      setIdeas(a.ideas)
      setPosts(b.posts)
      setLogs(c.logs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the database')
    }
  }, [])

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10))
    load()
  }, [load])

  const ideaById = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas])
  const winners = useMemo(() => {
    const m = new Map<Platform, Set<string>>()
    for (const p of PLATFORMS) m.set(p, new Set(winnerThreshold({ posts, platform: p }).winnerPostIds))
    return m
  }, [posts])
  const paces = useMemo(() => {
    if (!today) return null
    return PLATFORMS.map((p) =>
      pace({ followerLogs: logs, platform: p, goal: FOLLOWER_GOAL, deadline: GOAL_DEADLINE, today }),
    )
  }, [logs, today])

  const queued = posts.filter((p) => p.status === 'queued')
  const posted = posts
    .filter((p) => p.status === 'posted')
    .sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0))
  const bank = ideas

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-white">Content OS</h1>
            <p className="text-[11px] text-zinc-500">@adam.jbrr</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-zinc-900 rounded-full p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.id ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-24 flex flex-col gap-6">
        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
            {error}{' '}
            <button onClick={load} className="underline ml-1">
              Retry
            </button>
            <p className="text-xs text-red-400/70 mt-1">
              Local dev: start the DB (`npm run db:start`) and run with `env -u SUPABASE_URL npm run dev`.
            </p>
          </div>
        )}

        {tab === 'today' && (
          <TodayTab
            paces={paces}
            queued={queued}
            ideaById={ideaById}
            busy={busy}
            onPosted={(post) =>
              act(`post-${post.id}`, () => {
                const v = prompt('Views so far? (leave blank to skip)')
                return send(`/api/posts/${post.id}`, 'PATCH', {
                  status: 'posted',
                  postedAt: Date.now(),
                  views: v && !isNaN(Number(v)) ? Number(v) : undefined,
                })
              })
            }
          />
        )}

        {tab === 'bank' && (
          <BankTab
            bank={bank}
            busy={busy}
            onGenerateSave={(text) => act('gen-save', () => send('/api/ideas', 'POST', { text }))}
            onMakeShootable={(idea) =>
              act(`shoot-${idea.id}`, () => send('/api/make-shootable', 'POST', { ideaId: idea.id, text: idea.text }))
            }
            onQueue={(idea, platform) =>
              act(`q-${idea.id}-${platform}`, () => send('/api/posts', 'POST', { ideaId: idea.id, platform }))
            }
          />
        )}

        {tab === 'results' && (
          <ResultsTab
            posted={posted}
            winners={winners}
            ideaById={ideaById}
            today={today}
            busy={busy}
            onLogFollowers={(platform, count) =>
              act('log', () => send('/api/follower-logs', 'POST', { platform, date: today, count }))
            }
            onBackfill={(rows) => act('backfill', () => send('/api/backfill', 'POST', { rows }))}
          />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-zinc-900 border-t border-zinc-800 sm:hidden">
        <div className="flex max-w-2xl mx-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-semibold ${tab === t.id ? 'text-amber-500' : 'text-zinc-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// ---- Today ------------------------------------------------------------------

function TodayTab({
  paces,
  queued,
  ideaById,
  busy,
  onPosted,
}: {
  paces: ReturnType<typeof pace>[] | null
  queued: Post[]
  ideaById: Map<string, Idea>
  busy: string | null
  onPosted: (p: Post) => void
}) {
  return (
    <>
      <section>
        <Eyebrow>Pace to {FOLLOWER_GOAL.toLocaleString()} · by {GOAL_DEADLINE}</Eyebrow>
        <div className="flex gap-2.5">
          {paces?.map((p) => (
            <div key={p.platform} className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-zinc-400">{PLATFORM_LABEL[p.platform]}</span>
                <span className={`text-[11px] font-bold ${p.aheadBehind >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {p.aheadBehind >= 0 ? `+${p.aheadBehind} ahead` : `${Math.abs(p.aheadBehind)} behind`}
                </span>
              </div>
              <div className="text-xl font-extrabold tracking-tight tabular-nums text-white">
                {p.current.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-500 tabular-nums">~{p.perDayRequired}/day to go</div>
            </div>
          )) ?? <div className="text-xs text-zinc-500">Loading pace…</div>}
        </div>
      </section>

      <section>
        <Eyebrow>Today to film · {queued.length}</Eyebrow>
        {queued.length === 0 ? (
          <Empty>Nothing queued. Make ideas shootable in the Bank, then queue them to a platform.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {queued.map((p) => {
              const idea = ideaById.get(p.ideaId)
              return (
                <div key={p.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Pill kind="platform">{PLATFORM_LABEL[p.platform]}</Pill>
                    {idea?.lane && <Pill kind="lane">{idea.lane}</Pill>}
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">{idea?.hook || idea?.text || '(idea missing)'}</p>
                  {idea?.draftLink && (
                    <a href={idea.draftLink} className="text-[11px] text-amber-500 mt-1 inline-block" target="_blank" rel="noreferrer">
                      draft link
                    </a>
                  )}
                  <div className="mt-2.5">
                    <button
                      onClick={() => onPosted(p)}
                      disabled={busy === `post-${p.id}`}
                      className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold px-3 py-2"
                    >
                      {busy === `post-${p.id}` ? 'Saving…' : 'Mark posted + log views'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

// ---- Bank -------------------------------------------------------------------

function BankTab({
  bank,
  busy,
  onGenerateSave,
  onMakeShootable,
  onQueue,
}: {
  bank: Idea[]
  busy: string | null
  onGenerateSave: (text: string) => void
  onMakeShootable: (i: Idea) => void
  onQueue: (i: Idea, p: Platform) => void
}) {
  const [draft, setDraft] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [generated, setGenerated] = useState<string[]>([])

  async function generate() {
    setGenBusy(true)
    try {
      const r = await fetch('/api/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      if (r.ok) setGenerated(d.ideas as string[])
    } finally {
      setGenBusy(false)
    }
  }

  return (
    <>
      <section>
        <Eyebrow>Add an idea</Eyebrow>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="POV: ..."
            className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => {
              if (draft.trim()) {
                onGenerateSave(draft.trim())
                setDraft('')
              }
            }}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold px-4"
          >
            Add
          </button>
        </div>
        <button onClick={generate} disabled={genBusy} className="mt-2 text-xs text-amber-500 disabled:opacity-50">
          {genBusy ? 'Generating…' : '✨ Generate 10 with Claude'}
        </button>
        {generated.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5">
            {generated.map((g, i) => (
              <button
                key={i}
                onClick={() => {
                  onGenerateSave(g)
                  setGenerated((arr) => arr.filter((_, k) => k !== i))
                }}
                className="text-left text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2 text-zinc-200"
              >
                + {g}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <Eyebrow>Idea bank · {bank.length}</Eyebrow>
        {bank.length === 0 ? (
          <Empty>Bank&apos;s empty. Add an idea or generate a batch.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {bank.map((idea) => (
              <div key={idea.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[13px] text-zinc-100 leading-snug">{idea.hook || idea.text}</p>
                  <Status status={idea.status} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {idea.status === 'idea' && (
                    <button
                      onClick={() => onMakeShootable(idea)}
                      disabled={busy === `shoot-${idea.id}`}
                      className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sky-300 text-[11px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
                    >
                      {busy === `shoot-${idea.id}` ? 'Writing…' : 'Make shootable'}
                    </button>
                  )}
                  {idea.status === 'shootable' &&
                    PLATFORMS.map((p) => (
                      <button
                        key={p}
                        onClick={() => onQueue(idea, p)}
                        disabled={busy === `q-${idea.id}-${p}`}
                        className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-[11px] font-semibold px-2.5 py-1.5 disabled:opacity-50"
                      >
                        Queue → {PLATFORM_LABEL[p]}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

// ---- Results ----------------------------------------------------------------

function ResultsTab({
  posted,
  winners,
  ideaById,
  today,
  busy,
  onLogFollowers,
  onBackfill,
}: {
  posted: Post[]
  winners: Map<Platform, Set<string>>
  ideaById: Map<string, Idea>
  today: string
  busy: string | null
  onLogFollowers: (p: Platform, count: number) => void
  onBackfill: (rows: unknown[]) => void
}) {
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [raw, setRaw] = useState('')

  function parseBackfill(): unknown[] {
    // one row per line: platform | text | date(YYYY-MM-DD) | views | lane | followerDelta
    return raw
      .split('\n')
      .map((l) => l.split('|').map((s) => s.trim()))
      .filter((c) => c.length >= 3 && c[0] && c[1] && c[2])
      .map((c) => ({
        platform: c[0],
        text: c[1],
        date: c[2],
        views: c[3] ? Number(c[3]) : undefined,
        lane: c[4] || undefined,
        followerDelta: c[5] ? Number(c[5]) : undefined,
      }))
  }

  return (
    <>
      <section>
        <Eyebrow>Log followers ({today})</Eyebrow>
        <div className="flex gap-2">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex-1 flex gap-1.5">
              <input
                inputMode="numeric"
                value={counts[p] ?? ''}
                onChange={(e) => setCounts((c) => ({ ...c, [p]: e.target.value }))}
                placeholder={PLATFORM_LABEL[p]}
                className="flex-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => {
                  const n = Number(counts[p])
                  if (!isNaN(n) && counts[p]) onLogFollowers(p, n)
                }}
                disabled={busy === 'log'}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold px-2.5 disabled:opacity-50"
              >
                Log
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Eyebrow>Posted · {posted.length}</Eyebrow>
        {posted.length === 0 ? (
          <Empty>No posts logged yet. Backfill your recent ones below to warm up the winner ranking.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {posted.map((p) => {
              const isWinner = winners.get(p.platform)?.has(p.id)
              const idea = ideaById.get(p.ideaId)
              return (
                <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[13px] text-zinc-200 leading-snug">{idea?.hook || idea?.text || '(idea)'} </p>
                    {isWinner && <span className="text-amber-500" title="winner">★</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 tabular-nums">
                    <Pill kind="platform">{PLATFORM_LABEL[p.platform]}</Pill>
                    <span>{(p.views ?? 0).toLocaleString()} views</span>
                    {typeof p.followerDeltaCandidate === 'number' && <span>+{p.followerDeltaCandidate} followers</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <Eyebrow>Backfill recent posts</Eyebrow>
        <p className="text-[11px] text-zinc-500 mb-1">
          One per line: <code>platform | text | YYYY-MM-DD | views | lane | followerDelta</code>
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder={'tiktok | POV: leg day vs finals | 2026-06-20 | 42000 | gym | 180'}
          className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-xs text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => {
            const rows = parseBackfill()
            if (rows.length) {
              onBackfill(rows)
              setRaw('')
            }
          }}
          disabled={busy === 'backfill'}
          className="mt-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 py-2 disabled:opacity-50"
        >
          {busy === 'backfill' ? 'Importing…' : 'Import'}
        </button>
      </section>
    </>
  )
}

// ---- shared bits ------------------------------------------------------------

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 mb-2">{children}</p>
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">{children}</div>
}
function Pill({ kind, children }: { kind: 'platform' | 'lane'; children: ReactNode }) {
  const cls = kind === 'platform' ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' : 'bg-zinc-800 text-zinc-400'
  return <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${cls}`}>{children}</span>
}
function Status({ status }: { status: Idea['status'] }) {
  const map = {
    idea: 'bg-zinc-800 text-zinc-400',
    shootable: 'bg-sky-950 text-sky-300',
  } as const
  return <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${map[status]}`}>{status}</span>
}
