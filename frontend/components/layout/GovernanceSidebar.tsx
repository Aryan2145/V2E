'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Gavel, BarChart2, ClipboardList, FileText } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Meetings', href: '/dashboard/governance/meetings', Icon: CalendarDays },
  { label: 'Decision Log', href: '/dashboard/governance/decisions', Icon: Gavel },
  { label: 'Reports', href: '/dashboard/governance/reports', Icon: BarChart2 },
  { label: 'Daily Update', href: '/dashboard/governance/daily-update', Icon: ClipboardList },
  { label: 'Work Log', href: '/dashboard/governance/work-log', Icon: FileText },
]

export default function GovernanceSidebar() {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside className="sticky top-14 h-[calc(100vh-56px)] bg-[#0F172A] flex flex-col shrink-0 z-30 w-16 md:w-[240px] overflow-hidden">
      <div className="h-12 flex items-center px-4 border-b border-white/10 shrink-0">
        <span className="hidden md:block text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">
          Governance
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={[
                'flex items-center rounded-[8px] py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                'justify-center md:justify-start px-2 md:px-3 md:gap-3',
                active ? 'bg-[#2563EB] text-white' : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-[#F1F5F9]',
              ].join(' ')}
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
