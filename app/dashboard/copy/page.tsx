import InsightsPanel from '@/components/InsightsPanel'
import CopyGenerator from '@/components/CopyGenerator'
import DraftsList from '@/components/DraftsList'

export default function CopyPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">文案建議</h1>
        <p className="text-sm text-gray-500 mt-1">
          根據你的 PI 訂單資料，AI 自動分析市場分佈與投放優先順序，點「立即生成」直接產出文案。
        </p>
      </div>

      <InsightsPanel />

      <details className="group">
        <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600 select-none list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          手動選擇 PI 與產品
        </summary>
        <div className="mt-6">
          <CopyGenerator />
        </div>
      </details>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">已儲存的文案</h2>
        <DraftsList />
      </div>
    </div>
  )
}
