import type { ContentIdea } from './types'

const KEYS = {
  ideas: 'cos_ideas',
} as const

export const storage = {
  getIdeas(): ContentIdea[] {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(localStorage.getItem(KEYS.ideas) ?? '[]')
    } catch {
      return []
    }
  },

  saveIdeas(ideas: ContentIdea[]): void {
    localStorage.setItem(KEYS.ideas, JSON.stringify(ideas))
  },

  addIdea(idea: ContentIdea): void {
    const existing = storage.getIdeas()
    // Deduplicate by text content so saving the same idea twice doesn't create duplicates
    if (existing.find((i) => i.text === idea.text)) return
    storage.saveIdeas([idea, ...existing])
  },

  removeIdea(id: string): void {
    storage.saveIdeas(storage.getIdeas().filter((i) => i.id !== id))
  },
}
