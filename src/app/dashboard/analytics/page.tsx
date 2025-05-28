import { Metadata } from 'next'
import { UsageAnalytics } from '@/components/dashboard/usage-analytics'

export const metadata: Metadata = {
  title: 'Usage Analytics | Dashboard',
  description: 'View your credit usage, transaction history, and usage analytics.',
}

export default function AnalyticsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Usage Analytics</h2>
        <div className="flex items-center space-x-2">
          {/* Future: Add export/download buttons */}
        </div>
      </div>
      <UsageAnalytics />
    </div>
  )
} 