import { createAnthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

// 直接把 PDF 交給 Claude 讀（原生支援 PDF 文件輸入，含掃描檔的 OCR），
// 不額外引入 pdf-parse 之類的函式庫 — 手冊常見表格/圖片排版，
// 用 vision 讀比純文字抽取準確，也一次解決「掃描檔需要 OCR」的問題。
export interface ManualChunk {
  partName: string          // 零件名稱（盡量用手冊原文，之後靠 manual_sku_map 對應 SKU）
  symptom: string           // 什麼情境/故障現象會需要這個零件
  content: string           // 完整說明段落，作為 embedding 與 RAG 回傳的內容
  specHints: string          // 規格線索（尺寸、相容性等），若無則空字串
}

const MANUAL_CHUNKS_SCHEMA = z.object({
  chunks: z.array(
    z.object({
      partName: z.string(),
      symptom: z.string(),
      content: z.string(),
      specHints: z.string(),
    })
  ),
})

export async function extractManualChunks(
  pdfBuffer: Buffer,
  productCategory: string,
  anthropicApiKey?: string
): Promise<ManualChunk[]> {
  const anthropic = createAnthropic({
    apiKey: anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
  })

  const { object } = await generateObject({
    model: anthropic('claude-opus-4-8'),
    schema: MANUAL_CHUNKS_SCHEMA,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: pdfBuffer,
            mediaType: 'application/pdf',
          },
          {
            type: 'text',
            text: `這是一份「${productCategory}」品類的維修手冊。請把內容切分成獨立的維修知識片段，每個片段對應「一個零件」或「一種故障情境」。

規則：
- partName：零件在手冊中的名稱或編號，盡量保留原文用詞（之後要拿去跟 Patisco SKU 對應）
- symptom：什麼樣的故障描述/客戶反映會對應到這個零件（用維修技師會描述問題的口吻）
- content：完整說明，包含判斷方式、更換步驟摘要、規格等，這段會被拿去做語意檢索，資訊要完整
- specHints：抽出關鍵規格數字（尺寸、孔徑、相容性等），沒有就留空字串
- 不要虛構手冊沒有的內容
- 忽略封面、目錄、版權頁等非技術內容`,
          },
        ],
      },
    ],
  })

  return object.chunks
}

// 抓網頁內容並粗略去除 HTML 標籤，交給 Claude 自己從雜訊中判讀正文（比自己寫 parser 精準）
export async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PactureRepairBot/1.0)' },
  })
  if (!res.ok) throw new Error(`無法取得網頁內容（HTTP ${res.status}）：${url}`)
  const html = await res.text()
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50000)
}

// 給網址／純文字來源用（例如品牌官網的保固條款、退換貨政策頁），跟 PDF 手冊共用同一個 chunk 結構，
// 只是內容通常是「政策說明」而非「零件故障對應」，所以 symptom 允許留空。
export async function extractChunksFromText(
  text: string,
  productCategory: string,
  anthropicApiKey?: string
): Promise<ManualChunk[]> {
  const anthropic = createAnthropic({
    apiKey: anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
  })

  const { object } = await generateObject({
    model: anthropic('claude-opus-4-8'),
    schema: MANUAL_CHUNKS_SCHEMA,
    prompt: `以下是「${productCategory}」品類相關的參考資料（可能是維修手冊內容、也可能是品牌官網的保固/退換貨政策頁面）。
請切分成獨立的知識片段，每個片段對應「一個零件/故障情境」或「一個政策主題」（例如：瑕疵保固範圍、墜車折扣重購方案、退換貨流程、排除項目等）。

規則：
- partName：這段內容的主題/零件名稱，盡量用原文用詞
- symptom：若是零件故障對應內容，填故障情境；若是政策類內容（保固條款、退換流程等）沒有對應故障情境，留空字串即可
- content：完整說明，這段會被拿去做語意檢索，資訊要完整，數字（年限、折扣％、天數等）務必保留原文精確數字，不要換算或省略
- specHints：規格線索，政策類內容留空字串
- 不要虛構原文沒有的內容
- 忽略導覽列、頁尾、行銷標語等非實質內容

參考資料原文：
${text}`,
  })

  return object.chunks
}
