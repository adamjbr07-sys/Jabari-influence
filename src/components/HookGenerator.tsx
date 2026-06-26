'use client'

import { useState, useEffect } from 'react'
import type { HookOutput } from '@/lib/types'

interface Props {
  initialIdea?: string
}

export default function HookGenerator({ initialIdea = '' }: Props) {
  const [idea, setIdea] = useState(initialIdea)
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState<HookOutput | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!initialIdea) return
    let cancelled = false
    async function autoGenerate() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/hook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: initialIdea }),
        })
        const data = await res.json()
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        setOutput(data as HookOutput)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    autoGenerate()
    return () => {
      cancelled = true
    }
  }, [initialIdea])

  async function generate() {
    if (!idea.trim()) return
    setLoading(true)
    setError('')
    setOutput(null)
    try {
      const res = await fetch('/api/hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOutput(data as HookOutput)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !loading && idea.trim()) {
      e.preventDefault()
      generate()
    }
  }

  function handleClear() {
    setIdea('')
    setOutput(null)
    setError('')
  }

  const sections = output
    ? [
        {
          key: 'hook',
          label: 'On-Screen Hook',
          sublabel: 'First 1–2 seconds of the video',
          emoji: '🎬',
          text: output.hookText,
        },
        {
          key: 'tiktok',
          label: 'TikTok Caption',
          sublabel: '≤150 chars · 5–8 hashtags',
          emoji: '🎵',
          text: output.tiktokCaption,
        },
        {
          key: 'ig',
          label: 'Instagram Caption',
          sublabel: '3–5 hashtags',
          emoji: '📸',
          text: output.igCaption,
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      {/* Idea input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Your Content Idea
          </p>
          {idea.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          data-testid="idea-input"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. POV: your gym bro gives you unsolicited form advice while you're mid-set..."
          rows={3}
          className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-amber-500 transition-colors"
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-zinc-600">Press Enter to generate</p>
          {idea.length > 0 && (
            <p className="text-xs text-zinc-600">{idea.length} chars</p>
          )}
        </div>
      </div>

      {/* Generate button */}
      <button
        data-testid="generate-hook-btn"
        onClick={generate}
        disabled={loading || !idea.trim()}
        className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3.5 transition-all active:scale-95"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Writing captions...
          </span>
        ) : (
          'Generate Hook & Captions'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-400">
          {/oauth|login|subscription|credential|not connected|authentication|unauthor/i.test(error)
            ? 'Connect your Claude subscription on the host -- run "claude setup-token" and set CLAUDE_CODE_OAUTH_TOKEN, or run "claude /login".'
            : error}
        </div>
      )}

      {/* Regenerate + Copy All (when output exists) */}
      {output && (
        <div className="flex gap-2">
          <button
            data-testid="regenerate-hook-btn"
            onClick={generate}
            disabled={loading}
            className="flex-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm font-semibold py-3 transition-all"
          >
            {loading ? 'Regenerating...' : '↺ Regenerate'}
          </button>
          <button
            data-testid="copy-all"
            onClick={() =>
              copyText(
                `HOOK:\n${output.hookText}\n\nTIKTOK:\n${output.tiktokCaption}\n\nINSTAGRAM:\n${output.igCaption}`,
                'all'
              )
            }
            className="flex-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold py-3 transition-all"
          >
            {copied === 'all' ? '✓ Copied All' : 'Copy All'}
          </button>
        </div>
      )}

      {/* Output sections */}
      {sections.map((s) => (
        <div key={s.key} data-testid={`output-${s.key}`} className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2">
              <span>{s.emoji}</span>
              <span className="text-sm font-semibold text-white">{s.label}</span>
              <span className="text-xs text-zinc-500">{s.sublabel}</span>
            </div>
            <button
              data-testid={`copy-${s.key}`}
              onClick={() => copyText(s.text, s.key)}
              className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-1 transition-all"
            >
              {copied === s.key ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{s.text}</p>
          </div>
        </div>
      ))}

      {/* Tip when empty */}
      {!output && !loading && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center">
          <p className="text-zinc-500 text-sm">
            Paste an idea above or use the{' '}
            <span className="text-amber-500 font-medium">&ldquo;Use this →&rdquo;</span> button
            from the Ideas tab to pre-fill.
          </p>
        </div>
      )}
    </div>
  )
}
