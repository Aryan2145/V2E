'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, BarChart2, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'

interface LearningAdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem { label: string; href: string; Icon: any; exact?: boolean }

const HR_NAV: NavItem[] = [
  { label: 'Overview', href: '/learning', Icon: LayoutDashboard, exact: true },
  { label: 'Learning Paths', href: '/learning/paths', Icon: BookOpen },
  { label: 'Progress', href: '/learning/progress', Icon: BarChart2 },
]

const EMP_NAV: NavItem[] = [
  { label: 'My Learning', href: '/learning/my', Icon: GraduationCap },
]

export default function LearningAdminSidebar({ collapsed, onToggle }: LearningAdminSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const isHR = user?.role === 'org_admin' || user?.role === 'hr_manager'
  const navItems = isHR ? HR_NAV : EMP_NAV

  return (
    <aside
      className={[
        'fixed left-0 top-14 h-[calc(100vh-56px)] bg-[#0F172A] flex flex-col z-40',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        collapsed ? 'w-16' : 'w-[240px]',
      ].join(' ')}
    >
      <div className="h-12 flex items-center border-b border-white/10 shrink-0 px-2">
        {!collapsed && (
          <span className="flex-1 px-2 text-xs font-semibold text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">
            Learning
          </span>
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-0.5">
        {navItems.map(({ label, href, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
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
