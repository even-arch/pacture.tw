import RepairChatWidget from '@/components/RepairChatWidget'

export default function RepairPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">維修助理</h1>
          <p className="text-sm text-gray-500 mt-1">
            描述客人的維修問題，AI 會比對已上傳的維修手冊給出零件建議，並查詢購買紀錄與保固狀態。
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <a href="/dashboard/repair/manuals" className="text-gray-500 hover:text-gray-900">維修手冊 →</a>
          <a href="/dashboard/repair/policies" className="text-gray-500 hover:text-gray-900">保固政策 →</a>
          <a href="/dashboard/repair/escalations" className="text-gray-500 hover:text-gray-900">待確認問題 →</a>
        </div>
      </div>

      <RepairChatWidget />
    </div>
  )
}
