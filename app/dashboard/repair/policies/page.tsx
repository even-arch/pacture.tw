import PolicyManager from '@/components/PolicyManager'

export default function RepairPoliciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">保固政策設定</h1>
        <p className="text-sm text-gray-500 mt-1">
          依品類設定瑕疵保固與墜車折扣重購規則，維修助理會依此自動判斷理賠比例。
        </p>
      </div>

      <PolicyManager />
    </div>
  )
}
