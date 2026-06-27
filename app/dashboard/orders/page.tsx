import { requireSession } from '@/lib/session'
import { sql } from '@/lib/db'
import SyncButton from '@/components/SyncButton'

const STATUS_LABEL: Record<string, string> = {
  confirmed: '已確認',
  archived: '已封存',
  pending: '待處理',
  draft: '草稿',
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  draft: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

export default async function OrdersPage() {
  const session = await requireSession()

  const rows = await sql`
    SELECT
      id, pi_id, pi_no,
      product_categories, customer_region,
      status, synced_at,
      raw_data->'buyer'->>'name' AS buyer_name,
      raw_data->>'price' AS price,
      raw_data->>'currencyCode' AS currency_code,
      raw_data->>'itemsCount' AS items_count
    FROM proforma_invoices
    WHERE user_id = ${session.userId}
    ORDER BY synced_at DESC
  `

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">形式發票（PI）</h2>
        <SyncButton />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">尚無資料，請點擊「同步 Patisco」匯入訂單。</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">PI 單號</th>
                <th className="px-4 py-3 font-medium">買家</th>
                <th className="px-4 py-3 font-medium">地區</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 font-medium text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = row.status as string
                return (
                  <tr key={row.id as string} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{row.pi_no as string}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{(row.buyer_name as string) ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(row.customer_region as string) ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {((row.product_categories as string[]) ?? []).slice(0, 3).map((cat) => (
                          <span key={cat} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded">
                            {cat}
                          </span>
                        ))}
                        {((row.product_categories as string[]) ?? []).length > 3 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">+{((row.product_categories as string[]).length - 3)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {row.price as string}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700">
            共 {rows.length} 筆
          </div>
        </div>
      )}
    </div>
  )
}
