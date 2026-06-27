import { requireSession } from '@/lib/session'
import { sql } from '@/lib/db'
import PerformancePanel from '@/components/PerformancePanel'

export default async function DashboardPage() {
  const session = await requireSession()

  const [piRow] = await sql`
    SELECT COUNT(*) AS total FROM proforma_invoices WHERE user_id = ${session.userId}
  `
  const [draftRow] = await sql`
    SELECT COUNT(*) AS total FROM copy_drafts WHERE user_id = ${session.userId}
  `
  const [pubRow] = await sql`
    SELECT COUNT(*) AS total FROM copy_drafts WHERE user_id = ${session.userId} AND is_published = TRUE
  `

  const stats = [
    { label: '已同步 PI', value: Number(piRow?.total ?? 0) },
    { label: '已生成文案', value: Number(draftRow?.total ?? 0) },
    { label: '已投放廣告', value: Number(pubRow?.total ?? 0) },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">概覽</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">廣告投放成效與帳戶總覽</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Ad performance — client component (fetches from Meta/Google) */}
      <PerformancePanel />
    </div>
  )
}
