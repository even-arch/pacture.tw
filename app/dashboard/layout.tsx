export const dynamic = 'force-dynamic'

import { requireSession } from '@/lib/session'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const isManaged = session.serviceTier === 'managed'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-gray-900 dark:text-white">Pacture</span>
            {!isManaged && (
              <nav className="flex gap-4 text-sm">
                <a href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">概覽</a>
                <a href="/dashboard/orders" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">訂單</a>
                <a href="/dashboard/copy" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">文案</a>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{session.email}</span>
            {!isManaged && (
              <a href="/dashboard/settings" className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200" title="設定">⚙</a>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
