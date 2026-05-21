'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  ClipboardList,
} from 'lucide-react'

interface SubNavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
}

interface SubNavGroup {
  items: SubNavItem[]
}

const subNavGroups: SubNavGroup[] = [
  {
    items: [
      { label: 'Overview', href: '/dashboard/holidays', icon: <LayoutDashboard size={16} /> },
      { label: 'Org Calendar', href: '/dashboard/holidays/org', icon: <CalendarDays size={16} /> },
      { label: 'Departments', href: '/dashboard/holidays/departments', icon: <Building2 size={16} /> },
      { label: 'Individuals', href: '/dashboard/holidays/individuals', icon: <Users size={16} />, adminOnly: true },
    ],
  },
  {
    items: [
      { label: 'Audit Log', href: '/dashboard/holidays/audit', icon: <ClipboardList size={16} />, adminOnly: true },
    ],
  },
]

export default function HolidaysLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const role = user?.role
  const isAdminOrHR = role === 'org_admin' || role === 'hr_manager'

  function isActive(href: string): boolean {
    if (href === '/dashboard/holidays') return pathname === '/dashboard/holidays'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)] -mx-8 -my-8">
      <aside className="w-[200px] shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col pt-6 pb-4 px-3 gap-0">
        <p className="px-3 mb-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest">
          Holiday Management
        </p>
        {subNavGroups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="my-1.5 mx-3 h-px bg-[#E2E8F0]" />}
            {group.items.map((item) => {
              if (item.adminOnly && !isAdminOrHR) return null
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors duration-150',
                    active
                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                      : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]',
                  ].join(' ')}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </React.Fragment>
        ))}
      </aside>

      <main className="flex-1 min-w-0 px-8 py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
