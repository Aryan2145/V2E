'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'

interface HolidayTab {
  label: string
  href: string
  adminOnly?: boolean
}

const HOLIDAY_TABS: HolidayTab[] = [
  { label: 'Overview', href: '/foundation/holidays' },
  { label: 'Org Calendar', href: '/foundation/holidays/org' },
  { label: 'Departments', href: '/foundation/holidays/departments' },
  { label: 'Individuals', href: '/foundation/holidays/individuals', adminOnly: true },
  { label: 'Audit Log', href: '/foundation/holidays/audit', adminOnly: true },
]

/**
 * Holidays lives inside the Foundation module so the Foundation sidebar stays
 * persistent (no menu swap). Sub-sections render as in-page tabs — the same
 * pattern used by the Tasks → Projects module.
 */
export default function HolidaysLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const role = user?.role
  const isAdminOrHR = role === 'org_admin' || role === 'hr_manager'

  function isActive(href: string): boolean {
    if (href === '/foundation/holidays') return pathname === '/foundation/holidays'
    return pathname.startsWith(href)
  }

  return (
    <div>
      <div className="flex items-center gap-0 border-b border-[#E2E8F0] overflow-x-auto mb-6">
        {HOLIDAY_TABS.map((t) => {
          if (t.adminOnly && !isAdminOrHR) return null
          const active = isActive(t.href)
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

      {children}
    </div>
  )
}
