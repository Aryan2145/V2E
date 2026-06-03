'use client'

import MainLayout from '@/components/layout/MainLayout'
import TimeTravelBar from '@/components/dev/TimeTravelBar'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <div className="px-8 py-8">
        {children}
      </div>
      <TimeTravelBar />
    </MainLayout>
  )
}
