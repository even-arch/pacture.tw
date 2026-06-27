import { FirecrawlClient } from '@mendable/firecrawl-js'

// Sources per priority from spec
const SOURCES: Record<string, string[]> = {
  parktool: [
    'https://www.parktool.com/en-us/blog/repair-help',
  ],
  sheldonbrown: [
    'https://www.sheldonbrown.com/Harris/index.html',
  ],
  bikegremlin: [
    'https://bikegremlin.com/bicycle-repair/',
  ],
}

export interface ScrapedArticle {
  source_url: string
  title: string
  content: string
  product_category: string
}

function extractCategory(text: string, url: string): string {
  const lower = (text + ' ' + url).toLowerCase()
  const categoryMap: Record<string, string[]> = {
    pedal: ['pedal'],
    seatpost: ['seatpost', 'seat post'],
    chainring: ['chainring', 'chain ring', 'crankset'],
    derailleur: ['derailleur', 'derailer'],
    brake: ['brake', 'braking'],
    cable: ['cable', 'housing'],
    handlebar: ['handlebar', 'handle bar', 'stem'],
    wheel: ['wheel', 'rim', 'spoke', 'hub'],
    bottom_bracket: ['bottom bracket', 'bb shell'],
    cassette: ['cassette', 'sprocket', 'freewheel'],
    chain: ['chain', 'drivetrain'],
    tire: ['tire', 'tyre', 'tube'],
    fork: ['fork', 'headset'],
    saddle: ['saddle', 'seat'],
  }
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((k) => lower.includes(k))) return cat
  }
  return 'general'
}

export async function scrapeUrl(url: string): Promise<{ title: string; content: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not set')

  const client = new FirecrawlClient({ apiKey })
  const doc = await client.scrapeUrl(url, { formats: ['markdown'] })

  const markdown = (doc as { markdown?: string }).markdown
  if (!markdown) return null

  const meta = (doc as { metadata?: { title?: string } }).metadata
  const title = meta?.title ?? url
  const content = markdown.slice(0, 8000)

  return { title, content }
}

export async function scrapeSource(
  sourceName: keyof typeof SOURCES
): Promise<ScrapedArticle[]> {
  const urls = SOURCES[sourceName]
  const articles: ScrapedArticle[] = []

  for (const url of urls) {
    try {
      const result = await scrapeUrl(url)
      if (!result) continue
      articles.push({
        source_url: url,
        title: result.title,
        content: result.content,
        product_category: extractCategory(result.title + ' ' + result.content, url),
      })
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err)
    }
  }

  return articles
}

export async function scrapeCategoryPages(
  category: string,
  source: 'parktool' | 'sheldonbrown' | 'bikegremlin' = 'parktool'
): Promise<ScrapedArticle[]> {
  const searchUrls: Record<string, string> = {
    parktool: `https://www.parktool.com/en-us/blog/repair-help?category=${encodeURIComponent(category)}`,
    sheldonbrown: `https://www.sheldonbrown.com/${category.replace('_', '-')}.html`,
    bikegremlin: `https://bikegremlin.com/${category.replace('_', '-')}/`,
  }

  const url = searchUrls[source]
  try {
    const result = await scrapeUrl(url)
    if (!result) return []
    return [{
      source_url: url,
      title: result.title,
      content: result.content,
      product_category: category,
    }]
  } catch {
    return []
  }
}
