import { NextRequest, NextResponse } from 'next/server'
import type { Category } from '@/lib/types'

const CATEGORY_SUBREDDITS: Record<Category, string[]> = {
  'gym': ['GYM', 'fitness'],
  'muslim-arab': ['islam', 'MuslimLounge'],
  'engineering': ['EngineeringStudents', 'engineering'],
  'canadian': ['canada', 'ontario'],
  'arab-canadian': ['islam', 'canada'],
}

async function redditHot(subreddit: string): Promise<string[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=10&raw_json=1`,
    {
      headers: { 'User-Agent': 'ContentOS/1.0 (content-creator-tool)' },
      next: { revalidate: 1800 },
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.data?.children ?? [])
    .map((p: { data: { title: string } }) => p.data.title)
    .filter((t: string) => t.length > 15 && t.length < 180)
    .slice(0, 4)
}

async function googleTrendsCA(): Promise<string[]> {
  const res = await fetch(
    'https://trends.google.com/trends/trendingsearches/daily/rss?geo=CA',
    { next: { revalidate: 1800 } }
  )
  if (!res.ok) return []
  const text = await res.text()
  return [...text.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g)]
    .map((m) => m[1])
    .filter((t) => !t.includes('Google Trends') && t.length > 3)
    .slice(0, 4)
}

export async function GET(req: NextRequest) {
  const category = (req.nextUrl.searchParams.get('category') ?? 'gym') as Category
  const subreddits = CATEGORY_SUBREDDITS[category] ?? CATEGORY_SUBREDDITS['gym']

  const [redditResults, googleResults] = await Promise.allSettled([
    Promise.allSettled(subreddits.map(redditHot)),
    googleTrendsCA(),
  ])

  const redditPosts =
    redditResults.status === 'fulfilled'
      ? redditResults.value
          .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
          .slice(0, 5)
      : []

  const googleTrends =
    googleResults.status === 'fulfilled' ? googleResults.value : []

  return NextResponse.json({ reddit: redditPosts, google: googleTrends })
}
