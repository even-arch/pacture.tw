import { embed, embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { sql } from '@/lib/db'

function getEmbeddingModel(apiKey?: string) {
  const client = createOpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY })
  return client.embedding('text-embedding-ada-002')
}

export async function embedText(text: string, apiKey?: string): Promise<number[]> {
  const { embedding } = await embed({
    model: getEmbeddingModel(apiKey),
    value: text,
  })
  return embedding
}

export async function storeArticle(article: {
  product_category: string
  source_url: string
  title: string
  content: string
}): Promise<string> {
  const embedding = await embedText(`${article.title}\n\n${article.content}`)
  const vectorLiteral = `[${embedding.join(',')}]`

  const [row] = await sql`
    INSERT INTO knowledge_articles (product_category, source_url, title, content, embedding)
    VALUES (
      ${article.product_category},
      ${article.source_url},
      ${article.title},
      ${article.content},
      ${vectorLiteral}::vector
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  return row?.id ?? ''
}

export async function ragQuery(
  category: string,
  query: string,
  topK = 5,
  apiKey?: string
): Promise<Array<{ title: string; content: string; source_url: string }>> {
  const queryEmbedding = await embedText(query, apiKey)
  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  const rows = await sql`
    SELECT title, content, source_url
    FROM knowledge_articles
    WHERE product_category = ${category}
       OR product_category = 'general'
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `
  return rows as Array<{ title: string; content: string; source_url: string }>
}

export async function storeArticles(
  articles: Array<{
    product_category: string
    source_url: string
    title: string
    content: string
  }>,
  apiKey?: string
): Promise<number> {
  const texts = articles.map((a) => `${a.title}\n\n${a.content}`)
  const { embeddings } = await embedMany({
    model: getEmbeddingModel(apiKey),
    values: texts,
  })

  let stored = 0
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const vectorLiteral = `[${embeddings[i].join(',')}]`
    await sql`
      INSERT INTO knowledge_articles (product_category, source_url, title, content, embedding)
      VALUES (
        ${a.product_category},
        ${a.source_url},
        ${a.title},
        ${a.content},
        ${vectorLiteral}::vector
      )
      ON CONFLICT DO NOTHING
    `
    stored++
  }
  return stored
}
