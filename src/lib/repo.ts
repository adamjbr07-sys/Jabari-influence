// =============================================================================
// Content OS v2 — repository layer (Lane A, T2)
// =============================================================================
// The only place that talks to Supabase. Maps DB rows (snake_case, timestamptz)
// to the contract types (camelCase, epoch-ms) from src/lib/types.ts. Pure mappers
// are exported for unit testing (T4); async CRUD wraps db().
// Replaces the old localStorage `storage.ts`; `importLegacyIdeas` migrates any
// existing `cos_ideas` (read client-side, passed in here).
// =============================================================================

import { db } from './db'
import {
  type Idea,
  type Post,
  type FollowerLog,
  type IdeaStatus,
  type PostStatus,
  type Platform,
  type ContentIdea,
} from './types'

// ---- DB row shapes (snake_case, as Postgres returns them) -------------------

interface IdeaRow {
  id: string
  text: string
  status: string
  hook: string | null
  caption: string | null
  format: string | null
  lane: string | null
  draft_link: string | null
  source_idea_id: string | null
  created_at: string // ISO timestamptz
}
interface PostRow {
  id: string
  idea_id: string
  platform: string
  status: string
  views: number | null
  posted_at: string | null
  edit_minutes: number | null
  follower_delta_candidate: number | null
  is_winner: boolean
  created_at: string
}
interface FollowerLogRow {
  id: string
  platform: string
  date: string // 'YYYY-MM-DD'
  count: number
}

// ---- pure mappers (exported for T4) -----------------------------------------

const ms = (iso: string | null): number => (iso ? Date.parse(iso) : 0)

export function rowToIdea(r: IdeaRow): Idea {
  return {
    id: r.id,
    text: r.text,
    status: r.status as IdeaStatus,
    hook: r.hook ?? undefined,
    caption: r.caption ?? undefined,
    format: r.format ?? undefined,
    lane: r.lane ?? undefined,
    draftLink: r.draft_link ?? undefined,
    sourceIdeaId: r.source_idea_id ?? undefined,
    createdAt: ms(r.created_at),
  }
}

export function rowToPost(r: PostRow): Post {
  return {
    id: r.id,
    ideaId: r.idea_id,
    platform: r.platform as Platform,
    status: r.status as PostStatus,
    views: r.views ?? undefined,
    postedAt: r.posted_at ? ms(r.posted_at) : undefined,
    editMinutes: r.edit_minutes ?? undefined,
    followerDeltaCandidate: r.follower_delta_candidate, // keep null (D5 "ambiguous")
    isWinner: r.is_winner,
    createdAt: ms(r.created_at),
  }
}

export function rowToFollowerLog(r: FollowerLogRow): FollowerLog {
  return { id: r.id, platform: r.platform as Platform, date: r.date, count: r.count }
}

/** Legacy `cos_ideas` (text + category + createdAt) -> a new idea insert. */
export function legacyIdeaToInsert(c: ContentIdea): Record<string, unknown> {
  return { text: c.text, status: 'idea', lane: c.category }
}

// insert/update payload builder: omit undefined so DB defaults apply
function clean(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

// ---- ideas ------------------------------------------------------------------

export async function createIdea(
  input: Pick<Idea, 'text'> & Partial<Idea>,
): Promise<Idea> {
  const payload = clean({
    text: input.text,
    status: input.status ?? 'idea',
    hook: input.hook,
    caption: input.caption,
    format: input.format,
    lane: input.lane,
    draft_link: input.draftLink,
    source_idea_id: input.sourceIdeaId,
  })
  const { data, error } = await db().from('ideas').insert(payload).select().single()
  if (error) throw error
  return rowToIdea(data as IdeaRow)
}

export async function listIdeas(status?: IdeaStatus): Promise<Idea[]> {
  let q = db().from('ideas').select('*').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data as IdeaRow[]).map(rowToIdea)
}

export async function updateIdea(id: string, patch: Partial<Idea>): Promise<Idea> {
  const payload = clean({
    text: patch.text,
    status: patch.status,
    hook: patch.hook,
    caption: patch.caption,
    format: patch.format,
    lane: patch.lane,
    draft_link: patch.draftLink,
  })
  const { data, error } = await db().from('ideas').update(payload).eq('id', id).select().single()
  if (error) throw error
  return rowToIdea(data as IdeaRow)
}

// ---- posts ------------------------------------------------------------------

export async function createPost(
  input: Pick<Post, 'ideaId' | 'platform'> & Partial<Post>,
): Promise<Post> {
  const payload = clean({
    idea_id: input.ideaId,
    platform: input.platform,
    status: input.status ?? 'queued',
    views: input.views,
    posted_at: input.postedAt ? new Date(input.postedAt).toISOString() : undefined,
    edit_minutes: input.editMinutes,
    follower_delta_candidate: input.followerDeltaCandidate,
    is_winner: input.isWinner,
  })
  const { data, error } = await db().from('posts').insert(payload).select().single()
  if (error) throw error
  return rowToPost(data as PostRow)
}

export async function listPosts(filter?: {
  platform?: Platform
  status?: PostStatus
}): Promise<Post[]> {
  let q = db().from('posts').select('*')
  if (filter?.platform) q = q.eq('platform', filter.platform)
  if (filter?.status) q = q.eq('status', filter.status)
  const { data, error } = await q
  if (error) throw error
  return (data as PostRow[]).map(rowToPost)
}

export async function updatePost(id: string, patch: Partial<Post>): Promise<Post> {
  const payload = clean({
    status: patch.status,
    views: patch.views,
    posted_at: patch.postedAt ? new Date(patch.postedAt).toISOString() : undefined,
    edit_minutes: patch.editMinutes,
    follower_delta_candidate: patch.followerDeltaCandidate,
    is_winner: patch.isWinner,
  })
  const { data, error } = await db().from('posts').update(payload).eq('id', id).select().single()
  if (error) throw error
  return rowToPost(data as PostRow)
}

// ---- follower_logs ----------------------------------------------------------

export async function upsertFollowerLog(
  platform: Platform,
  date: string,
  count: number,
): Promise<FollowerLog> {
  const { data, error } = await db()
    .from('follower_logs')
    .upsert({ platform, date, count }, { onConflict: 'platform,date' })
    .select()
    .single()
  if (error) throw error
  return rowToFollowerLog(data as FollowerLogRow)
}

export async function listFollowerLogs(platform?: Platform): Promise<FollowerLog[]> {
  let q = db().from('follower_logs').select('*').order('date', { ascending: true })
  if (platform) q = q.eq('platform', platform)
  const { data, error } = await q
  if (error) throw error
  return (data as FollowerLogRow[]).map(rowToFollowerLog)
}

// ---- legacy migration (one-time; cos_ideas read client-side) -----------------

export async function importLegacyIdeas(legacy: ContentIdea[]): Promise<number> {
  if (legacy.length === 0) return 0
  const rows = legacy.map(legacyIdeaToInsert)
  const { data, error } = await db().from('ideas').insert(rows).select('id')
  if (error) throw error
  return (data as { id: string }[]).length
}
