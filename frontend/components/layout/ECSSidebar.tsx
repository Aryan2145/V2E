'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, ChevronLeft, ChevronRight, User, CalendarOff, CheckSquare } from 'lucide-react'

interface ECSSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { label: 'My Profile', href: '/dashboard/ecs/profile', Icon: User },
  { label: 'My Leave', href: '/dashboard/ecs/leave', Icon: CalendarOff },
  { label: 'Approvals', href: '/dashboard/ecs/approvals', Icon: CheckSquare },
  { label: 'Company Policy', href: '/dashboard/ecs/company-policy', Icon: FileText },
]

export default function ECSSidebar({ collapsed, onToggle }: ECSSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={[
        'sticky top-14 h-[calc(100vh-56px)] bg-[#0F172A] flex flex-col shrink-0 z-30',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        collapsed ? 'w-16' : 'w-[240px]',
      ].join(' ')}
    >
      {/* Toggle button row */}
      <div className="h-12 flex items-center border-b border-white/10 shrink-0 px-2">
        {!collapsed && (
          <div className="flex-1 px-2 min-w-0">
            <span className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">
              ESS
            </span>
            <span className="block text-[10px] font-medium text-[#64748B] whitespace-nowrap leading-tight">
              Employee Self Service
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, href, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={[
                'flex items-center rounded-[8px] py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-[#F1F5F9]',
              ].join(' ')}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
