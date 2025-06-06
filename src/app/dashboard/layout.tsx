import { Navbar } from '@/components/navigation/navbar'
import { SubscriptionStatusChecker } from '@/components/subscription-status-checker'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <SubscriptionStatusChecker />
      <main>{children}</main>
    </div>
  )
} 