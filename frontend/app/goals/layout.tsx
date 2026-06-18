'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import MainLayout from '@/components/layout/MainLayout'

const TABS = [
  { label: 'Objectives', href: '/goals/objectives' },
  { label: 'Annual Goals', href: '/goals/annual' },
  { label: 'Quarterly Goals', href: '/goals/quarterly' },
  { label: 'Balanced Scorecard', href: '/goals/scorecard' },
]

export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Hide the tab bar on detail pages (/goals/<id>) — they have their own breadcrumb.
  const isDetail = /^\/goals\/[^/]+$/.test(pathname) && !TABS.some((t) => t.href === pathname)

  return (
    <MainLayout>
      <div className="px-8 py-8 max-w-[1200px] mx-auto">
        {!isDetail && (
          <div className="flex items-center gap-0 border-b border-[#E2E8F0] overflow-x-auto mb-6">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                    active
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1]',
                  ].join(' ')}
                >
                  {t.label}
                </Link>
              )
            })}
          </div>
        )}
        {children}
      </div>
    </MainLayout>
  )
}
