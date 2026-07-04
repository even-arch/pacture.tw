import ManualUploader from '@/components/ManualUploader'

export default function RepairManualsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">維修手冊管理</h1>
        <p className="text-sm text-gray-500 mt-1">
          上傳 PDF 維修手冊，AI 會自動切分成零件段落並建立索引，供維修助理對話使用。
        </p>
      </div>

      <ManualUploader />
    </div>
  )
}
