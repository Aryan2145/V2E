'use client'

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
} from 'lucide-react'

interface SubNavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  disabled?: boolean
}

interface SubNavGroup {
  items: SubNavItem[]
}

const subNavGroups: SubNavGroup[] = [
  {
    items: [
      { label: 'Overview', href: '/dashboard/tasks', icon: <LayoutDashboard size={16} /> },
      { label: 'My Tasks', href: '/dashboard/tasks/my', icon: <CheckSquare size={16} /> },
      { label: 'Assigned by Me', href: '/dashboard/tasks/assigned', icon: <UserCheck size={16} /> },
      { label: 'Recurring', href: '/dashboard/tasks/recurring', icon: <RotateCcw size={16} /> },
      { label: 'Escalated', href: '/dashboard/tasks/escalated', icon: <AlertTriangle size={16} /> },
      { label: 'Collective', href: '/dashboard/tasks/collective', icon: <Globe size={16} /> },
      { label: 'Archive', href: '/dashboard/tasks/archive', icon: <Archive size={16} />, adminOnly: true },
      { label: 'Reports', href: '/dashboard/tasks/reports', icon: <BarChart2 size={16} />, adminOnly: true },
    ],
  },
  {
    items: [
      { label: 'Workflows', href: '/dashboard/tasks/workflows', icon: <GitBranch size={16} /> },
      { label: 'My Workflows', href: '/dashboard/tasks/workflows/my', icon: <GitBranch size={16} /> },
    ],
  },
  {
    items: [
      { label: 'Tickets', href: '/dashboard/tasks/tickets', icon: <Ticket size={16} /> },
      { label: 'My Tickets', href: '/dashboard/tasks/tickets/my', icon: <Ticket size={16} /> },
      { label: 'Assigned to Me', href: '/dashboard/tasks/tickets/assigned', icon: <Ticket size={16} /> },
      { label: 'Archive', href: '/dashboard/tasks/tickets/archive', icon: <Archive size={16} /> },
      { label: 'Reports', href: '/dashboard/tasks/tickets/reports', icon: <BarChart2 size={16} /> },
    ],
  },
  {
    items: [
      { label: 'Masters', href: '/dashboard/tasks/masters', icon: <Settings2 size={16} />, adminOnly: true },
    ],
  },
]

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const role = user?.role

  const isAdminOrHR = role === 'org_admin' || role === 'hr_manager'

  function isActive(href: string): boolean {
    if (href === '/dashboard/tasks') return pathname === '/dashboard/tasks'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)] -mx-8 -my-8">
      {/* Sub-nav sidebar */}
      <aside className="w-[200px] shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col pt-6 pb-4 px-3 gap-0">
        <p className="px-3 mb-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest">
          Task Management
        </p>
        {subNavGroups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="my-1.5 mx-3 h-px bg-[#E2E8F0]" />}
            {group.items.map((item) => {
              if (item.adminOnly && !isAdminOrHR) return null
              if (item.disabled) return (
                <span
                  key={item.href}
                  className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium text-[#CBD5E1] cursor-not-allowed"
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="ml-auto text-[9px] font-semibold text-[#94A3B8] bg-[#F1F5F9] px-1 py-0.5 rounded">Soon</span>
                </span>
              )
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

      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 py-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
