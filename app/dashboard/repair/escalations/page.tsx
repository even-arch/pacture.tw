import EscalationQueue from '@/components/EscalationQueue'

export default function RepairEscalationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">待人工確認的問題</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI 答不出來的問題會出現在這裡，回答後會自動存回知識庫，下次同類問題就能直接由 AI 回答。
        </p>
      </div>

      <EscalationQueue />
    </div>
  )
}
