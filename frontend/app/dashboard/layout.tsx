'use client'

import MainLayout from '@/components/layout/MainLayout'
import TimeTravelBar from '@/components/dev/TimeTravelBar'
import { useAuth } from '@/lib/auth/context'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  // The TEST CLOCK bar is fixed to the bottom of the viewport — reserve space
  // for it so page content is never hidden underneath.
  const hasClockBar = !!user?.isTestOrg

  return (
    <MainLayout>
      <div className={`px-4 sm:px-6 lg:px-8 py-6 lg:py-8 ${hasClockBar ? 'pb-28' : ''}`}>
        {children}
      </div>
      <TimeTravelBar />
    </MainLayout>
  )
}
