'use client'

import { useState } from 'react'
import type { Category, ContentIdea } from '@/lib/types'
import { storage } from '@/lib/storage'

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'gym', label: 'Gym', emoji: '🏋️' },
  { value: 'muslim-arab', label: 'Muslim & Arab', emoji: '🌙' },
  { value: 'engineering', label: 'Engineering', emoji: '⚙️' },
  { value: 'canadian', label: 'Canadian', emoji: '🇨🇦' },
  { value: 'arab-canadian', label: 'Arab-Canadian', emoji: '🤝' },
]

interface Props {
  onUseIdea: (idea: string) => void
}

interface Trends {
  reddit: string[]
  google: string[]
}

export default function IdeaGenerator({ onUseIdea }: Props) {
  const [category, setCategory] = useState<Category>('gym')
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [ideas, setIdeas] = useState<string[]>([])
  const [saved, setSaved] = useState<ContentIdea[]>(() => storage.getIdeas())
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [savedIdx, setSavedIdx] = useState<number | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsError, setTrendsError] = useState('')

  async function loadTrends() {
    setTrendsLoading(true)
    setTrendsError('')
    try {
      const res = await fetch(`/api/trends?category=${category}`)
      if (!res.ok) throw new Error('Failed to load trends')
      const data = await res.json()
      setTrends(data)
    } catch {
      setTrendsError('Could not load trends. Reddit may be rate-limiting.')
    } finally {
      setTrendsLoading(false)
    }
  }

  function applyTrend(topic: string) {
    setSituation((prev) => (prev ? `${prev} — inspired by: ${topic}` : topic))
  }

  async function generate() {
    setLoading(true)
    setError('')
    setIdeas([])
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, situation }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const lines = (data.ideas as string)
        .split('\n')
        .map((l: string) => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean)
      setIdeas(lines)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function saveIdea(text: string, idx: number) {
    const idea: ContentIdea = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      category,
      createdAt: Date.now(),
    }
    storage.addIdea(idea)
    setSaved(storage.getIdeas())
    setSavedIdx(idx)
    setTimeout(() => setSavedIdx(null), 1500)
  }

  function removeIdea(id: string) {
    storage.removeIdea(id)
    setSaved(storage.getIdeas())
  }

  async function copyIdea(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault()
      generate()
    }
  }

  const allTrends = trends ? [...trends.reddit, ...trends.google] : []

  return (
    <div className="flex flex-col gap-6">
      {/* Category selector */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              data-testid={`category-${c.value}`}
              onClick={() => {
                setCategory(c.value)
                setTrends(null)
                setTrendsError('')
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                category === c.value
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span>{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Now */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            🔥 Trending Now
          </p>
          <button
            data-testid="load-trends-btn"
            onClick={loadTrends}
            disabled={trendsLoading}
            className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors font-medium"
          >
            {trendsLoading ? 'Loading...' : trends ? '↺ Refresh' : 'Load trends'}
          </button>
        </div>

        {trendsError && (
          <p className="text-xs text-zinc-600 italic">{trendsError}</p>
        )}

        {!trends && !trendsLoading && !trendsError && (
          <p className="text-xs text-zinc-600">
            Pull live trending topics from Reddit &amp; Google to inspire your ideas.
          </p>
        )}

        {allTrends.length > 0 && (
          <div data-testid="trends-list" className="flex flex-wrap gap-2">
            {allTrends.map((topic, i) => (
              <button
                key={i}
                onClick={() => applyTrend(topic)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 rounded-lg px-3 py-1.5 text-left transition-all leading-snug max-w-full"
              >
                {topic.length > 60 ? `${topic.slice(0, 60)}…` : topic}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Situation input */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">
          What&apos;s the vibe today? <span className="text-zinc-600">(optional)</span>
        </p>
        <textarea
          data-testid="situation-input"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. just finished midterms, feeling cooked... or it's Ramadan and I'm starving at the gym..."
          rows={2}
          className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-amber-500 transition-colors"
        />
        <p className="text-xs text-zinc-600 mt-1">Press Enter to generate</p>
      </div>

      {/* Generate button */}
      <button
        data-testid="generate-ideas-btn"
        onClick={generate}
        disabled={loading}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3.5 transition-all active:scale-95"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          'Generate 10 Ideas'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-400">
          {error.includes('API_KEY') || error.includes('api_key') || error.includes('authentication')
            ? 'Add your Anthropic API key to .env.local to use this feature.'
            : error}
        </div>
      )}

      {/* Generated ideas */}
      {ideas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Generated Ideas
            </p>
            <button
              data-testid="regenerate-ideas-btn"
              onClick={generate}
              disabled={loading}
              className="text-xs text-zinc-500 hover:text-amber-400 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Regenerating...' : '↺ Regenerate'}
            </button>
          </div>
          <div className="flex flex-col gap-2" data-testid="ideas-list">
            {ideas.map((idea, i) => (
              <div
                key={i}
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3"
              >
                <p className="text-sm text-white mb-3 leading-relaxed">{idea}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseIdea(idea)}
                    className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold py-1.5 transition-all active:scale-95"
                  >
                    Use this →
                  </button>
                  <button
                    onClick={() => copyIdea(idea, i)}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-1.5 transition-all"
                  >
                    {copiedIdx === i ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => saveIdea(idea, i)}
                    className={`rounded-lg text-xs font-medium px-3 py-1.5 transition-all ${
                      savedIdx === i
                        ? 'bg-green-900 text-green-400'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {savedIdx === i ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved ideas */}
      {saved.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Saved Ideas ({saved.length})
          </p>
          <div className="flex flex-col gap-2" data-testid="saved-list">
            {saved.map((idea) => (
              <div
                key={idea.id}
                className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3"
              >
                <p className="text-sm text-white mb-3 leading-relaxed">{idea.text}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseIdea(idea.text)}
                    className="flex-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold py-1.5 transition-all active:scale-95"
                  >
                    Use this →
                  </button>
                  <button
                    onClick={() => removeIdea(idea.id)}
                    className="rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-500 hover:text-red-400 text-xs font-medium px-3 py-1.5 transition-all"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
