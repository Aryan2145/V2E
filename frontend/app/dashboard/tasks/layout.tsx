'use client'

import { useState } from 'react'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import {
  LayoutDashboard,
  CheckSquare,
  UserCheck,
  RotateCcw,
  AlertTriangle,
  Archive,
  BarChart2,
  Settings2,
  Globe,
  GitBranch,
  Ticket,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  Icon: React.ElementType
  adminOnly?: boolean
  disabled?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Tasks',
    items: [
      { label: 'Overview', href: '/dashboard/tasks', Icon: LayoutDashboard },
      { label: 'My Tasks', href: '/dashboard/tasks/my', Icon: CheckSquare },
      { label: 'Assigned by Me', href: '/dashboard/tasks/assigned', Icon: UserCheck },
      { label: 'Recurring', href: '/dashboard/tasks/recurring', Icon: RotateCcw },
      { label: 'Escalated', href: '/dashboard/tasks/escalated', Icon: AlertTriangle },
      { label: "CC'd Tasks", href: '/dashboard/tasks/cc', Icon: Eye },
      { label: 'Collective', href: '/dashboard/tasks/collective', Icon: Globe },
      { label: 'Archive', href: '/dashboard/tasks/archive', Icon: Archive, adminOnly: true },
      { label: 'Reports', href: '/dashboard/tasks/reports', Icon: BarChart2, adminOnly: true },
    ],
  },
  {
    label: 'Projects',
    items: [
      { label: 'Projects', href: '/dashboard/projects', Icon: Briefcase },
      { label: 'My Projects', href: '/dashboard/projects/my', Icon: Briefcase },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { label: 'Workflows', href: '/dashboard/tasks/workflows', Icon: GitBranch },
      { label: 'My Workflows', href: '/dashboard/tasks/workflows/my', Icon: GitBranch },
    ],
  },
  {
    label: 'Tickets',
    items: [
      { label: 'Tickets', href: '/dashboard/tasks/tickets', Icon: Ticket },
      { label: 'My Tickets', href: '/dashboard/tasks/tickets/my', Icon: Ticket },
      { label: 'Assigned to Me', href: '/dashboard/tasks/tickets/assigned', Icon: Ticket },
      { label: 'Archive', href: '/dashboard/tasks/tickets/archive', Icon: Archive },
      { label: 'Reports', href: '/dashboard/tasks/tickets/reports', Icon: BarChart2 },
    ],
  },
  {
    label: 'Config',
    items: [
      { label: 'Masters', href: '/dashboard/tasks/masters', Icon: Settings2, adminOnly: true },
    ],
  },
]

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const isAdminOrHR = user?.role === 'org_admin' || user?.role === 'hr_manager'

  function isActive(href: string): boolean {
    if (href === '/dashboard/tasks') return pathname === '/dashboard/tasks'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)] -mx-8 -my-8">

      {/* Dark collapsible sidebar */}
      <aside
        className={[
          'sticky top-14 h-[calc(100vh-56px)] bg-[#0F172A] flex flex-col shrink-0 z-30',
          'transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'w-16' : 'w-[240px]',
        ].join(' ')}
      >
        {/* Header row with toggle */}
        <div className="h-12 flex items-center border-b border-white/10 shrink-0 px-2">
          {!collapsed && (
            <span className="flex-1 px-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">
              Task Management
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
          {NAV_GROUPS.map((group, gi) => {
            const visibleItems = group.items.filter(
              (item) => !(item.adminOnly && !isAdminOrHR)
            )
            if (visibleItems.length === 0) return null

            return (
              <React.Fragment key={gi}>
                {gi > 0 && (
                  <div className={['my-1 h-px bg-white/10', collapsed ? 'mx-1' : 'mx-2'].join(' ')} />
                )}
                {!collapsed && group.label && (
                  <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[#475569] uppercase tracking-widest">
                    {group.label}
                  </p>
                )}
                {visibleItems.map((item) => {
                  if (item.disabled) {
                    return (
                      <span
                        key={item.href}
                        title={collapsed ? item.label : undefined}
                        className={[
                          'flex items-center rounded-[8px] py-2.5 text-sm font-medium text-[#334155] cursor-not-allowed',
                          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                        ].join(' ')}
                      >
                        <item.Icon size={18} className="shrink-0" />
                        {!collapsed && (
                          <>
                            <span>{item.label}</span>
                            <span className="ml-auto text-[9px] font-semibold text-[#475569] bg-[#1E293B] px-1.5 py-0.5 rounded">
                              Soon
                            </span>
                          </>
                        )}
                      </span>
                    )
                  }

                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={[
                        'flex items-center rounded-[8px] py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                        active
                          ? 'bg-[#2563EB] text-white'
                          : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-[#F1F5F9]',
                      ].join(' ')}
                    >
                      <item.Icon size={18} className="shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </React.Fragment>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
