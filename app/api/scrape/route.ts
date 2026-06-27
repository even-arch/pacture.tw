import { NextRequest, NextResponse } from 'next/server'
import { scrapeUrl } from '@/lib/scraper'
import { storeArticles } from '@/lib/embeddings'
import { getUserKeys } from '@/lib/user-keys'
import { cookies } from 'next/headers'

export const maxDuration = 300

// Predefined repair-help pages from Park Tool by topic
const PARKTOOL_PAGES = [
  { url: 'https://www.parktool.com/en-us/blog/repair-help/pedal-installation-and-removal', category: 'pedal' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/seatpost-removal-and-installation', category: 'seatpost' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/chain-wear-elongation', category: 'chain' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/rear-derailleur-adjustment', category: 'derailleur' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/brake-pad-replacement-rim-brakes', category: 'brake' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/cassette-removal-and-installation', category: 'cassette' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/bottom-bracket-service', category: 'bottom_bracket' },
  { url: 'https://www.parktool.com/en-us/blog/repair-help/handlebar-stem-installation', category: 'handlebar' },
]

export async function POST(req: NextRequest) {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = JSON.parse(raw)
  const { openaiApiKey } = await getUserKeys(userId)

  const { category } = await req.json().catch(() => ({ category: null }))

  const pages = category
    ? PARKTOOL_PAGES.filter((p) => p.category === category)
    : PARKTOOL_PAGES

  const articles = []
  for (const page of pages) {
    try {
      const result = await scrapeUrl(page.url)
      if (result) {
        articles.push({
          product_category: page.category,
          source_url: page.url,
          title: result.title,
          content: result.content,
        })
      }
    } catch (err) {
      console.error(`Scrape failed ${page.url}:`, err)
    }
  }

  const stored = await storeArticles(articles, openaiApiKey || undefined)
  return NextResponse.json({ scraped: articles.length, stored })
}

export async function GET() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sql } = await import('@/lib/db')
  const rows = await sql`
    SELECT product_category, COUNT(*) as count
    FROM knowledge_articles
    GROUP BY product_category
    ORDER BY count DESC
  `
  return NextResponse.json({ categories: rows })
}
