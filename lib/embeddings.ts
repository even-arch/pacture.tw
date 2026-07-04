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
  apiKey?: string,
  sourceType?: 'scraped' | 'manual'
): Promise<Array<{ title: string; content: string; source_url: string }>> {
  const queryEmbedding = await embedText(query, apiKey)
  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  const rows = await sql`
    SELECT title, content, source_url
    FROM knowledge_articles
    WHERE (product_category = ${category} OR product_category = 'general')
      AND (${sourceType ?? null}::text IS NULL OR source_type = ${sourceType ?? null})
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `
  return rows as Array<{ title: string; content: string; source_url: string }>
}

// 維修助理專用查詢：不綁品類（症狀描述當下還不知道是哪個品類），只在手冊內容裡做語意搜尋
export async function ragQueryManuals(
  query: string,
  topK = 5,
  apiKey?: string
): Promise<Array<{ title: string; content: string; product_category: string }>> {
  const queryEmbedding = await embedText(query, apiKey)
  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  const rows = await sql`
    SELECT title, content, product_category
    FROM knowledge_articles
    WHERE source_type = 'manual'
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `
  return rows as Array<{ title: string; content: string; product_category: string }>
}

// 維修手冊片段存入 knowledge_articles，source_type='manual' 讓它跟行銷知識庫（爬蟲）分開檢索
export async function storeManualChunks(
  manualId: string,
  productCategory: string,
  chunks: Array<{ partName: string; symptom: string; content: string; specHints: string }>,
  apiKey?: string
): Promise<number> {
  const texts = chunks.map(
    (c) => `${c.partName}\n情境：${c.symptom}\n${c.content}${c.specHints ? `\n規格：${c.specHints}` : ''}`
  )
  const { embeddings } = await embedMany({
    model: getEmbeddingModel(apiKey),
    values: texts,
  })

  let stored = 0
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    const vectorLiteral = `[${embeddings[i].join(',')}]`
    await sql`
      INSERT INTO knowledge_articles (product_category, source_url, title, content, embedding, source_type, manual_id)
      VALUES (
        ${productCategory},
        NULL,
        ${c.partName},
        ${texts[i]},
        ${vectorLiteral}::vector,
        'manual',
        ${manualId}
      )
    `
    stored++
  }
  return stored
}

// 同仁回答完 repair_escalations 裡的問題後，把 Q&A 存回知識庫——這是整個人工介入機制的閉環：
// 下次同類問題進來，ragQueryManuals 就能直接查到這則答案，不用再問人一次
export async function storeStaffAnswer(
  productCategory: string,
  question: string,
  answer: string,
  apiKey?: string
): Promise<string> {
  const content = `Q：${question}\nA：${answer}`
  const embedding = await embedText(content, apiKey)
  const vectorLiteral = `[${embedding.join(',')}]`

  const [row] = await sql`
    INSERT INTO knowledge_articles (product_category, source_url, title, content, embedding, source_type, manual_id)
    VALUES (${productCategory}, NULL, ${question}, ${content}, ${vectorLiteral}::vector, 'manual', NULL)
    RETURNING id
  `
  return row?.id ?? ''
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
