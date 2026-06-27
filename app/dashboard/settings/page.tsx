import SettingsForm from '@/components/SettingsForm'

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500 mt-1">連結你自己的 AI 服務帳號，文案生成費用由你的帳號承擔。</p>
      </div>
      <SettingsForm />
    </div>
  )
}
