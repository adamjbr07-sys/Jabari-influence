'use client'

import { useState } from 'react'
import IdeaGenerator from '@/components/IdeaGenerator'
import HookGenerator from '@/components/HookGenerator'

type Tab = 'ideas' | 'captions'

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'ideas', label: 'Ideas', emoji: '💡' },
  { id: 'captions', label: 'Hook & Captions', emoji: '✏️' },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>('ideas')
  const [pendingIdea, setPendingIdea] = useState('')

  function handleUseIdea(idea: string) {
    setPendingIdea(idea)
    setActiveTab('captions')
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Content OS</h1>
            <p className="text-xs text-zinc-500">@adam.jbrr</p>
          </div>
          <div className="flex items-center gap-1 bg-zinc-900 rounded-full p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                aria-label={tab.label}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{tab.emoji}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {activeTab === 'ideas' && <IdeaGenerator onUseIdea={handleUseIdea} />}
        {activeTab === 'captions' && (
          <HookGenerator key={pendingIdea} initialIdea={pendingIdea} />
        )}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-zinc-900 border-t border-zinc-800 sm:hidden">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all ${
                activeTab === tab.id ? 'text-amber-500' : 'text-zinc-500'
              }`}
            >
              <span className="text-xl leading-none">{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
