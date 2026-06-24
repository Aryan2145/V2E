'use client'

import MainLayout from '@/components/layout/MainLayout'
import TimeTravelBar from '@/components/dev/TimeTravelBar'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The TEST CLOCK now collapses to a floating circular button, so it no longer
  // occupies layout height — no bottom space to reserve.
  return (
    <MainLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {children}
      </div>
      <TimeTravelBar />
    </MainLayout>
  )
}
