import { describe, it, expect } from 'vitest'
import { rowToIdea, rowToPost, rowToFollowerLog, legacyIdeaToInsert } from './repo'

// Pure mappers only — no DB. (CRUD wiring is typechecked + the schema is proven
// against the local stack in T1.)

describe('rowToIdea', () => {
  it('maps snake_case + timestamptz, nulls -> undefined, ISO -> epoch ms', () => {
    const idea = rowToIdea({
      id: 'i1',
      text: 'POV: leg day',
      status: 'shootable',
      hook: 'POV: ...',
      caption: null,
      format: null,
      lane: 'gym',
      draft_link: null,
      source_idea_id: null,
      created_at: '2026-06-26T00:00:00.000Z',
    })
    expect(idea).toMatchObject({ id: 'i1', text: 'POV: leg day', status: 'shootable', hook: 'POV: ...', lane: 'gym' })
    expect(idea.caption).toBeUndefined()
    expect(idea.sourceIdeaId).toBeUndefined()
    expect(idea.createdAt).toBe(Date.parse('2026-06-26T00:00:00.000Z'))
  })
})

describe('rowToPost', () => {
  it('keeps followerDeltaCandidate null (D5 "ambiguous"), maps posted_at to ms', () => {
    const p = rowToPost({
      id: 'p1',
      idea_id: 'i1',
      platform: 'tiktok',
      status: 'posted',
      views: 12000,
      posted_at: '2026-06-26T12:00:00.000Z',
      edit_minutes: null,
      follower_delta_candidate: null,
      is_winner: true,
      created_at: '2026-06-26T00:00:00.000Z',
    })
    expect(p).toMatchObject({ id: 'p1', ideaId: 'i1', platform: 'tiktok', status: 'posted', views: 12000, isWinner: true })
    expect(p.followerDeltaCandidate).toBeNull() // not undefined — ambiguity is meaningful
    expect(p.postedAt).toBe(Date.parse('2026-06-26T12:00:00.000Z'))
    expect(p.editMinutes).toBeUndefined()
  })

  it('preserves a real follower delta', () => {
    const p = rowToPost({
      id: 'p2', idea_id: 'i1', platform: 'instagram', status: 'posted',
      views: 100, posted_at: null, edit_minutes: 15, follower_delta_candidate: 42,
      is_winner: false, created_at: '2026-06-26T00:00:00.000Z',
    })
    expect(p.followerDeltaCandidate).toBe(42)
    expect(p.editMinutes).toBe(15)
    expect(p.postedAt).toBeUndefined()
  })
})

describe('rowToFollowerLog', () => {
  it('keeps the ISO date string as-is', () => {
    expect(rowToFollowerLog({ id: 'l1', platform: 'tiktok', date: '2026-06-26', count: 1650 })).toEqual({
      id: 'l1', platform: 'tiktok', date: '2026-06-26', count: 1650,
    })
  })
})

describe('legacyIdeaToInsert', () => {
  it('maps cos_ideas category -> lane, status idea', () => {
    expect(legacyIdeaToInsert({ id: 'x', text: 'old idea', category: 'gym', createdAt: 1 })).toEqual({
      text: 'old idea', status: 'idea', lane: 'gym',
    })
  })
})
