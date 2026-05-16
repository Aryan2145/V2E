'use client'

import MainLayout from '@/components/layout/MainLayout'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <div className="px-8 py-8 max-w-7xl mx-auto">
        {children}
      </div>
    </MainLayout>
  )
}
