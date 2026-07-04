import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { ragQueryManuals } from '@/lib/embeddings'
import { evaluateCoverage, yearsSince, type ClaimType, type WarrantyPolicy } from '@/lib/warranty'
import { createQuotationDraft } from '@/lib/patisco-mcp'

export type RepairStage = 'collecting' | 'recommending' | 'confirmed' | 'escalated' | 'done'

export interface RepairMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RepairRecommendation {
  partName: string
  patiscoSku: string | null
  available: boolean   // 手冊有記載，且有對應到 Patisco SKU
  claimType: ClaimType | null
  payPercentOfMsrp: number | null
  requiresOemClaim: boolean
}

export interface RepairTurnResult {
  sessionId: string
  stage: RepairStage
  reply: string
  recommendation: RepairRecommendation | null
}

const TURN_SCHEMA = z.object({
  reply: z.string().describe('要對店主說的話'),
  stage: z
    .enum(['collecting', 'recommending', 'confirmed', 'done'])
    .describe(
      'collecting=還在了解問題；recommending=已能從參考資料中指出明確的一個零件；confirmed=使用者剛剛明確表示要採購上一輪推薦的零件；done=已處理完成'
    ),
  partName: z
    .string()
    .nullable()
    .describe('只有 stage=recommending 或 confirmed 時才填，必須是參考資料裡出現過的零件名稱，不可自行發明'),
  claimType: z
    .enum(['defect', 'crash', 'unknown'])
    .nullable()
    .describe(
      '只有這個零件的問題「可能涉及保固/理賠」時才填：defect=零件本身瑕疵；crash=意外/墜車造成；unknown=可能涉及但無法判斷，需要再問。如果店主明顯只是一般補貨/耗材更換、不涉及保固問題，留 null 即可，不用特別問'
    ),
  escalate: z
    .boolean()
    .describe(
      'true＝店主問的問題（保固細節、規格、相容性等）你手上的參考資料不足以放心回答，不可以用常識或猜測回答，要交給同仁處理。這比硬答錯更重要——不確定就設 true'
    ),
  escalationQuestion: z.string().nullable().describe('escalate=true 時，用一句話摘要待確認的問題，方便同仁快速理解狀況'),
})

async function findLatestPurchase(userId: string, sku: string) {
  const rows = await sql`
    SELECT pi.pi_no AS pi_no, pi.created_date AS created_date, p->>'price' AS price
    FROM proforma_invoices pi,
         jsonb_array_elements(pi.raw_data->'products') AS p
    WHERE pi.user_id = ${userId}
      AND pi.status = 'confirmed'
      AND p->>'sku' = ${sku}
    ORDER BY pi.created_date DESC NULLS LAST
    LIMIT 1
  `
  return rows[0] as { pi_no: string; created_date: string | null; price: string | null } | undefined
}

async function resolveSku(partName: string) {
  const [row] = await sql`
    SELECT patisco_sku, product_category
    FROM manual_sku_map
    WHERE part_name ILIKE ${'%' + partName + '%'} OR ${partName} ILIKE '%' || part_name || '%'
    LIMIT 1
  `
  return row as { patisco_sku: string | null; product_category: string } | undefined
}

async function getPolicy(productCategory: string): Promise<WarrantyPolicy | undefined> {
  const [row] = await sql`
    SELECT is_wear_item, defect_lifetime, defect_years, defect_requires_original_owner,
           defect_subsequent_owner_years, crash_discount_pct, crash_free_years,
           crash_requires_original_owner, labor_included, claim_channel
    FROM warranty_policies WHERE product_category = ${productCategory}
  `
  if (!row) return undefined
  return {
    isWearItem: row.is_wear_item as boolean,
    defectLifetime: row.defect_lifetime as boolean,
    defectYears: row.defect_years as number | null,
    defectRequiresOriginalOwner: row.defect_requires_original_owner as boolean,
    defectSubsequentOwnerYears: row.defect_subsequent_owner_years as number | null,
    crashDiscountPct: row.crash_discount_pct as number | null,
    crashFreeYears: Number(row.crash_free_years),
    crashRequiresOriginalOwner: row.crash_requires_original_owner as boolean,
    laborIncluded: row.labor_included as boolean,
    claimChannel: row.claim_channel as string | null,
  }
}

// 依規劃文件第 7 章的邊界＋ENVE 這類品牌實際條款（瑕疵/墜車分流、依品類設定折扣時間表）組出事實區塊
async function buildFactualBlock(
  userId: string,
  partName: string,
  claimType: ClaimType | 'unknown' | null
): Promise<{ text: string; rec: RepairRecommendation }> {
  const mapping = await resolveSku(partName)

  if (!mapping || !mapping.patisco_sku) {
    return {
      text: `此零件目前未在供應清單，請聯繫業務人員確認貨源。`,
      rec: { partName, patiscoSku: null, available: false, claimType: claimType === 'unknown' ? null : claimType, payPercentOfMsrp: null, requiresOemClaim: false },
    }
  }

  const purchase = await findLatestPurchase(userId, mapping.patisco_sku)
  const years = purchase?.created_date ? yearsSince(new Date(purchase.created_date)) : null
  const purchaseLine = purchase?.created_date
    ? `您於 ${purchase.created_date.slice(0, 10)} 購入（PI ${purchase.pi_no}）。`
    : ''
  const priceLine = purchase?.price ? `\n購買時單價：${purchase.price}（僅供參考，實際下單價格請以 Patisco 為準）` : ''

  const baseFact = `建議零件：${partName}（SKU ${mapping.patisco_sku}）\n${purchaseLine}${priceLine}`.trim()

  if (claimType === 'unknown') {
    return {
      text: `${baseFact}\n這是因為意外碰撞/墜車造成的損壞，還是零件本身出問題？兩種對應的保固條件不一樣，麻煩確認一下。`,
      rec: { partName, patiscoSku: mapping.patisco_sku, available: true, claimType: null, payPercentOfMsrp: null, requiresOemClaim: false },
    }
  }
  if (!claimType) {
    // 不涉及保固/理賠判斷的一般補貨情境：只補客觀事實（SKU、購買紀錄），保固相關說明交給 AI 的 reply 本身
    // （若 AI 手上資料不足以判斷，AI 應該自己把 escalate 設成 true，而不是由這裡硬擋一句罐頭訊息）
    return {
      text: baseFact,
      rec: { partName, patiscoSku: mapping.patisco_sku, available: true, claimType: null, payPercentOfMsrp: null, requiresOemClaim: false },
    }
  }

  const policy = await getPolicy(mapping.product_category)
  if (!policy) {
    // 沒有為這個品類設定精確保固政策——這不是死路，AI 若能從參考資料判斷會寫在 reply 裡，
    // 若判斷不出來，AI 自己會把 escalate 設成 true 轉交同仁，這裡只補客觀事實
    return {
      text: baseFact,
      rec: { partName, patiscoSku: mapping.patisco_sku, available: true, claimType, payPercentOfMsrp: null, requiresOemClaim: false },
    }
  }

  const coverage = evaluateCoverage(policy, claimType, years)
  const oemLine = coverage.requiresOemClaim
    ? '\n此案件需另外向原廠提交保固/墜車申請審核，不是本地可直接認定，建議先送件確認後再處理後續採購。'
    : ''

  return {
    text: `建議零件：${partName}（SKU ${mapping.patisco_sku}）\n${purchaseLine}${coverage.reason}${oemLine}${priceLine}`.trim(),
    rec: {
      partName,
      patiscoSku: mapping.patisco_sku,
      available: true,
      claimType,
      payPercentOfMsrp: coverage.payPercentOfMsrp,
      requiresOemClaim: coverage.requiresOemClaim,
    },
  }
}

export async function postRepairMessage(params: {
  userId: string
  sessionId: string | null
  userMessage: string
  anthropicApiKey?: string
  openaiApiKey?: string
  patiscoJwt?: string
  patiscoApiKey?: string
}): Promise<RepairTurnResult> {
  const { userId, userMessage } = params

  let sessionId = params.sessionId
  let stage: RepairStage = 'collecting'
  let messages: RepairMessage[] = []

  if (sessionId) {
    const [row] = await sql`SELECT stage, messages FROM repair_sessions WHERE id = ${sessionId} AND user_id = ${userId}`
    if (row) {
      stage = row.stage as RepairStage
      messages = row.messages as RepairMessage[]
    } else {
      sessionId = null
    }
  }
  if (!sessionId) {
    const [created] = await sql`
      INSERT INTO repair_sessions (user_id, stage, messages) VALUES (${userId}, 'collecting', '[]') RETURNING id
    `
    sessionId = created.id as string
  }

  messages = [...messages, { role: 'user', content: userMessage }]

  const ragContext = await ragQueryManuals(userMessage, 5, params.openaiApiKey)
  const contextText = ragContext.length
    ? ragContext.map((r) => `[${r.title} / ${r.product_category}]\n${r.content}`).join('\n\n---\n\n')
    : '(目前尚未上傳任何維修手冊，無法比對零件)'

  const conversationText = messages.map((m) => `${m.role === 'user' ? '店主' : 'AI'}：${m.content}`).join('\n')

  const anthropic = createAnthropic({ apiKey: params.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY })

  const { object } = await generateObject({
    model: anthropic('claude-opus-4-8'),
    schema: TURN_SCHEMA,
    prompt: `你是自行車零件維修助理，服務對象是維修店店主，不是消費者。任務：從店主的問題描述中找出對應的零件，並在有把握的情況下回答保固/理賠相關問題。

目前階段：${stage}（collecting=還在了解問題／recommending=上一輪已推薦過零件／confirmed=店主已確認採購／escalated=上一輪已轉交同仁／done=已結束）

規則：
- 只能根據下方「參考資料」判斷零件與政策，不可以憑常識猜測或自行發明資料沒提到的內容
- 資訊不足時（例如不知道車架年份、規格），繼續用一句話追問最關鍵的缺口，語氣像技師對技師，不要一次問一堆
- 一旦能從參考資料中鎖定明確的一個零件，就進入 recommending，並把零件名稱原樣填入 partName（用參考資料原文的名稱，之後系統要拿去做對應）
- 如果上一輪你已經推薦過零件，而店主這輪明確表示要採購/下單/是，就進入 confirmed，partName 沿用同一個零件
- 只有在這個情況「可能涉及保固/理賠」時才判斷 claimType（defect=零件瑕疵／crash=意外墜車／unknown=可能涉及但無法判斷）；如果店主明顯只是一般補貨、不涉及保固問題，claimType 留 null
- 如果店主問的是保固/理賠/規格相容性等具體問題，而參考資料裡完全沒有可以依據的內容，不要編造答案，把 escalate 設成 true，並在 escalationQuestion 用一句話摘要問題
- 保固的「精確天數/折扣百分比」不要自己算，系統會依購買紀錄與政策設定在你的回覆後面自動補上；你只需要在 reply 裡說明參考資料裡「明確寫出的」文字型規則（例如「磨損件不賠」），不要換算出具體數字
- reply 只寫對話內容本身

參考資料（維修手冊/政策文件）：
${contextText}

目前對話記錄：
${conversationText}

請針對店主最新一則訊息給出回應。`,
  })

  let reply = object.reply
  let recommendation: RepairRecommendation | null = null
  let nextStage: RepairStage = object.stage

  if (object.escalate) {
    nextStage = 'escalated'
    const category = ragContext[0]?.product_category ?? null
    await sql`
      INSERT INTO repair_escalations (session_id, product_category, question)
      VALUES (${sessionId}, ${category}, ${object.escalationQuestion ?? userMessage})
    `
    reply = `${object.reply}\n\n這部分目前資料不足以直接回答，已經記錄下來請同仁確認，確認後會補充進系統，下次就能直接回答。`
  } else if ((nextStage === 'recommending' || nextStage === 'confirmed') && object.partName) {
    const claimType = object.claimType === 'unknown' ? 'unknown' : object.claimType
    const { text, rec } = await buildFactualBlock(userId, object.partName, claimType)
    reply = `${object.reply}\n\n${text}`
    recommendation = rec

    await sql`
      INSERT INTO repair_recommendations
        (session_id, part_name, patisco_sku, claim_type, pay_percent_of_msrp, requires_oem_claim, qt_status)
      VALUES (
        ${sessionId}, ${rec.partName}, ${rec.patiscoSku}, ${rec.claimType}, ${rec.payPercentOfMsrp},
        ${rec.requiresOemClaim}, 'not_available'
      )
    `
  }

  if (nextStage === 'confirmed' && recommendation?.patiscoSku && params.patiscoJwt && params.patiscoApiKey) {
    const qt = await createQuotationDraft({
      jwt: params.patiscoJwt,
      apiKey: params.patiscoApiKey,
      items: [{ sku: recommendation.patiscoSku, qty: 1 }],
      sourceSessionId: sessionId,
    })
    const priceNote =
      recommendation.payPercentOfMsrp !== null && recommendation.payPercentOfMsrp < 100
        ? `（依保固/墜車折扣方案，此筆應付比例約為 MSRP 的 ${recommendation.payPercentOfMsrp}%，實際金額請由業務於 Patisco 端調整）`
        : ''
    reply = `${reply}\n\n${qt.message}${priceNote}`
  }

  messages = [...messages, { role: 'assistant', content: reply }]

  await sql`
    UPDATE repair_sessions SET stage = ${nextStage}, messages = ${JSON.stringify(messages)}::jsonb, updated_at = now()
    WHERE id = ${sessionId}
  `

  return { sessionId, stage: nextStage, reply, recommendation }
}

export async function getRepairSession(userId: string, sessionId: string) {
  const [row] = await sql`
    SELECT id, stage, messages, created_at, updated_at FROM repair_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
  `
  return row as { id: string; stage: RepairStage; messages: RepairMessage[]; created_at: string; updated_at: string } | undefined
}

export async function listRepairSessions(userId: string) {
  const rows = await sql`
    SELECT id, stage, messages, created_at, updated_at FROM repair_sessions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `
  return rows as Array<{ id: string; stage: RepairStage; messages: RepairMessage[]; created_at: string; updated_at: string }>
}
