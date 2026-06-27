import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { cookies } from 'next/headers'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { getUserKeys } from '@/lib/user-keys'

export const maxDuration = 60

export interface Recommendation {
  sku: string
  specification: string
  priority: 'high' | 'medium' | 'low'
  reason: string
  suggestedPlatform: 'google' | 'meta' | 'both'
  suggestedFormat: 'search' | 'display' | 'youtube' | 'feed' | 'stories' | 'reels'
  targetCountries: string[]
  adAngle: string
  proposedHeadline: string
  proposedHook: string
  placements: string[]
  targetLanguage: string
  keywords: { direction: string; examples: string[]; matchType: string }
  schedule: { bestDays: string; bestHours: string; reasoning: string }
  downstreamType: 'b2b' | 'b2c' | 'mixed' | 'unknown'
  downstreamReasoning: string
  geoTargeting?: string
}

export interface AnalysisResult {
  id?: string
  createdAt?: string
  summary: string
  regionBreakdown: { countryCode: string; piCount: number }[]
  topProducts: { sku: string; specification: string; orderCount: number; countries: string[] }[]
  recommendations: Recommendation[]
}

async function getSession() {
  const store = await cookies()
  const raw = store.get('session')?.value
  if (!raw) return null
  return JSON.parse(raw) as { userId: string }
}

// ── GET: 讀最新一筆（不跑 Claude） ─────────────────────────────────────────

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [row] = await sql`
      SELECT id, summary, region_breakdown, top_products, recommendations, created_at
      FROM analysis_results
      WHERE user_id = ${session.userId} AND is_hidden = FALSE
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (!row) {
      // 確認是否有隱藏的記錄，讓前端決定要不要提供「顯示上一份」選項
      const [hiddenRow] = await sql`
        SELECT id FROM analysis_results
        WHERE user_id = ${session.userId} AND is_hidden = TRUE
        LIMIT 1
      `
      return NextResponse.json({ empty: true, hasHidden: !!hiddenRow })
    }

    const result: AnalysisResult = {
      id: row.id as string,
      createdAt: row.created_at as string,
      summary: row.summary as string,
      regionBreakdown: row.region_breakdown as AnalysisResult['regionBreakdown'],
      topProducts: row.top_products as AnalysisResult['topProducts'],
      recommendations: row.recommendations as Recommendation[],
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── POST: 跑新分析並寫入 DB ────────────────────────────────────────────────

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = session
    const { anthropicApiKey, firecrawlApiKey } = await getUserKeys(userId)
    if (!anthropicApiKey) {
      return NextResponse.json({ error: '請先至「設定」頁面設定 Anthropic API Key' }, { status: 422 })
    }

    const anthropic = createAnthropic({ apiKey: anthropicApiKey, baseURL: 'https://api.anthropic.com/v1' })

    const regionRows = await sql`
      SELECT
        COALESCE(raw_data->'buyer'->>'countryCode', 'Unknown') AS country_code,
        COUNT(*) AS pi_count
      FROM proforma_invoices
      WHERE user_id = ${userId}
      GROUP BY country_code
      ORDER BY pi_count DESC
    `

    const productRows = await sql`
      SELECT
        p->>'sku'                AS sku,
        MIN(p->>'specification') AS specification,
        COUNT(*)                 AS order_count,
        array_agg(DISTINCT COALESCE(raw_data->'buyer'->>'countryCode', 'Unknown')) AS countries
      FROM proforma_invoices,
           jsonb_array_elements(raw_data->'products') AS p
      WHERE user_id = ${userId}
        AND p->>'sku' IS NOT NULL
      GROUP BY sku
      ORDER BY order_count DESC
      LIMIT 15
    `

    const regionBreakdown = regionRows.map((r) => ({
      countryCode: r.country_code as string,
      piCount: Number(r.pi_count),
    }))

    const topProducts = productRows.map((r) => ({
      sku: r.sku as string,
      specification: (r.specification as string ?? '').slice(0, 120).replace(/\n/g, ' '),
      orderCount: Number(r.order_count),
      countries: r.countries as string[],
    }))

    // ── Firecrawl：查詢主要買方的下游類型 ─────────────────────────────────
    const buyerRows = await sql`
      SELECT DISTINCT
        raw_data->'buyer'->>'companyName' AS company_name,
        raw_data->'buyer'->>'website'     AS website,
        raw_data->'buyer'->>'email'       AS email,
        COALESCE(raw_data->'buyer'->>'countryCode', 'Unknown') AS country_code
      FROM proforma_invoices
      WHERE user_id = ${userId}
        AND raw_data->'buyer'->>'companyName' IS NOT NULL
      LIMIT 5
    `

    interface BuyerProfile {
      companyName: string
      countryCode: string
      downstreamHint: string
    }

    const buyerProfiles: BuyerProfile[] = []

    if (firecrawlApiKey) {
      for (const buyer of buyerRows) {
        const companyName = buyer.company_name as string
        const countryCode = buyer.country_code as string
        let website = buyer.website as string | null

        try {
          // 若 PI 沒有網址，用 Firecrawl search 找
          if (!website) {
            const searchRes = await fetch('https://api.firecrawl.dev/v1/search', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: `${companyName} official website`, limit: 1 }),
            })
            if (searchRes.ok) {
              const searchData = await searchRes.json()
              website = searchData?.data?.[0]?.url ?? null
            }
          }

          if (!website) continue

          // 爬取首頁，擷取前 800 字（控制 token）
          const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: website, formats: ['markdown'], maxDepth: 1 }),
          })
          if (!scrapeRes.ok) continue

          const scrapeData = await scrapeRes.json()
          const content = ((scrapeData?.data?.markdown ?? '') as string).slice(0, 800).replace(/\n+/g, ' ')

          buyerProfiles.push({ companyName, countryCode, downstreamHint: content })
        } catch {
          // 單一買方爬取失敗不影響整體分析
        }
      }
    }

    const buyerContext = buyerProfiles.length > 0
      ? `\n主要買方資訊（來自網站爬取）：\n` +
        buyerProfiles.map((b) =>
          `  公司：${b.companyName}（${b.countryCode}）\n  網站摘要：${b.downstreamHint}`
        ).join('\n')
      : ''

    const dataContext = `
地區分佈（PI 數量）：
${regionBreakdown.map((r) => `  ${r.countryCode}: ${r.piCount} 筆`).join('\n')}

熱銷產品（依訂單數排序）：
${topProducts.map((p) =>
  `  SKU: ${p.sku} | 訂單數: ${p.orderCount} | 市場: ${p.countries.join(',')} | 規格: ${p.specification}`
).join('\n')}
${buyerContext}`

    const prompt = `你是一位 B2B 數位廣告顧問，正在分析一家企業的形式發票（PI）資料，協助制定 Google 與 Meta 廣告投放策略。

以下是該企業的訂單資料摘要：
${dataContext}

請根據這些資料，提供具體的廣告投放建議。回傳純 JSON，格式如下（不要有 markdown 標記）：
{
  "summary": "2-3句話的整體分析，說明主力市場、核心產品與廣告機會點",
  "recommendations": [
    {
      "sku": "SKU代碼",
      "specification": "精簡的產品描述（不超過25字）",
      "priority": "high|medium|low",
      "reason": "為什麼這個產品值得投放廣告（1句話，含具體數據）",
      "suggestedPlatform": "google|meta|both",
      "suggestedFormat": "search|display|youtube|feed|stories|reels",
      "targetCountries": ["ISO國家代碼"],
      "adAngle": "廣告切入角度（1句話，說明核心訴求）",
      "proposedHeadline": "建議的廣告標題草稿（繁體中文，30字以內）",
      "proposedHook": "建議的開場句/Hook（繁體中文，吸引點擊的第一句話）",
      "placements": ["具體投放版位，例如：Google 搜尋結果頁頂部", "Facebook 動態消息", "Instagram 限時動態"],
      "targetLanguage": "主要廣告語言，例如：繁體中文、英文、日文",
      "keywords": {
        "direction": "關鍵字操作方向（1-2句，說明核心策略，例如：以品牌+功能型關鍵字為主，搭配競品關鍵字）",
        "examples": ["3-5個具體關鍵字或詞組範例"],
        "matchType": "建議的關鍵字比對類型與說明，例如：以完全比對為主，搭配詞組比對擴大觸及"
      },
      "schedule": {
        "bestDays": "建議投放的星期幾，例如：週一至週五（工作日）",
        "bestHours": "建議投放時段，例如：09:00–12:00、14:00–18:00（當地時間）",
        "reasoning": "時段選擇的理由（1句，根據目標市場與產品性質）"
      },
      "downstreamType": "b2b|b2c|mixed|unknown",
      "downstreamReasoning": "判斷依據（1-2句，說明從產品規格或買方網站得出的結論）",
      "geoTargeting": "地理定向建議：若 downstreamType 為 b2c，寫明以門市/倉庫為中心的建議投放半徑；若為 b2b，寫明目標城市或工業區"
    }
  ]
}

規則：
- recommendations 最多 5 項，選最有廣告潛力的
- priority: high = 訂單多且跨市場；medium = 單一市場但有量；low = 潛力新市場
- suggestedPlatform: B2B服務/SaaS → google；消費品/視覺商品 → meta；兩者皆適合 → both
- suggestedFormat: Google → search 或 display；Meta → feed 或 stories
- targetCountries 只列真正出現在訂單中的國家代碼
- placements 根據 suggestedPlatform 與 suggestedFormat 推導，列出 2-3 個具體版位
- targetLanguage 根據 targetCountries 推導主要語言
- keywords.examples 列出符合產品與市場的真實關鍵字，不要太泛（例如避免只寫「系統服務」）
- schedule 根據目標市場時區與 B2B 決策者的使用習慣推斷
- downstreamType 判斷邏輯：
  * 優先參考買方網站內容（如有）
  * 若無網站資料，從產品規格與批量判斷：工業零件/大批量 → b2b；消費品/小批量 → b2c
  * 若兩者訊號都有 → mixed；無法判斷 → unknown
- geoTargeting：b2c 案例寫「以 [城市] 門市為中心，建議半徑 20km」；b2b 案例寫目標工業區或城市範圍
- 回傳純 JSON，不要有任何說明文字`

    const { text } = await generateText({
      model: anthropic('claude-opus-4-8'),
      prompt,
      maxOutputTokens: 1500,
    })

    let analysisData: { summary: string; recommendations: Recommendation[] }
    try {
      const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
      analysisData = JSON.parse(cleaned)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      analysisData = match ? JSON.parse(match[0]) : { summary: text, recommendations: [] }
    }

    // 寫入 DB（永久保存，不自動刪除）
    const [saved] = await sql`
      INSERT INTO analysis_results (user_id, summary, region_breakdown, top_products, recommendations)
      VALUES (
        ${userId},
        ${analysisData.summary},
        ${JSON.stringify(regionBreakdown) as unknown as never},
        ${JSON.stringify(topProducts) as unknown as never},
        ${JSON.stringify(analysisData.recommendations) as unknown as never}
      )
      RETURNING id, created_at
    `

    const result: AnalysisResult = {
      id: saved.id as string,
      createdAt: saved.created_at as string,
      summary: analysisData.summary,
      regionBreakdown,
      topProducts,
      recommendations: analysisData.recommendations,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Analysis POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── PATCH: 隱藏 / 取消隱藏 ────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, action } = body as { id?: string; action?: string }

    if (action === 'unhide') {
      // 取消隱藏最後一筆（不需要 id，直接找最新的隱藏記錄）
      const [row] = await sql`
        UPDATE analysis_results
        SET is_hidden = FALSE
        WHERE id = (
          SELECT id FROM analysis_results
          WHERE user_id = ${session.userId} AND is_hidden = TRUE
          ORDER BY created_at DESC
          LIMIT 1
        )
        RETURNING id, summary, region_breakdown, top_products, recommendations, created_at
      `
      if (!row) return NextResponse.json({ error: '沒有隱藏的分析記錄' }, { status: 404 })
      return NextResponse.json({
        id: row.id,
        createdAt: row.created_at,
        summary: row.summary,
        regionBreakdown: row.region_breakdown,
        topProducts: row.top_products,
        recommendations: row.recommendations,
      })
    }

    // 預設：隱藏指定的一筆
    await sql`
      UPDATE analysis_results SET is_hidden = TRUE
      WHERE id = ${id} AND user_id = ${session.userId}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── DELETE: 移除 recommendations 陣列中的單一項目 ──────────────────────────

export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, index } = await req.json()
    if (typeof index !== 'number') {
      return NextResponse.json({ error: 'index required' }, { status: 400 })
    }

    await sql`
      UPDATE analysis_results
      SET recommendations = recommendations - ${index}
      WHERE id = ${id} AND user_id = ${session.userId}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
