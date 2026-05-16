'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Users,
  LayoutDashboard,
  BookOpen,
  Heart,
  GitBranch,
  Briefcase,
  UserCircle,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import type { UserRole } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarProps {
  role: UserRole
  orgId?: string
}

// ─── Nav configs per role ─────────────────────────────────────────────────────

const superAdminNav: NavItem[] = [
  { label: 'Dashboard', href: '/super-admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Organizations', href: '/super-admin/organizations', icon: <Building2 size={18} /> },
]

const orgStaffNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Identity', href: '/dashboard/identity', icon: <BookOpen size={18} /> },
  { label: 'Culture', href: '/dashboard/culture', icon: <Heart size={18} /> },
  { label: 'Org Chart', href: '/dashboard/org-chart', icon: <GitBranch size={18} /> },
  { label: 'Roles', href: '/dashboard/roles', icon: <Briefcase size={18} /> },
  { label: 'Employees', href: '/dashboard/employees', icon: <Users size={18} /> },
  { label: 'Setup', href: '/setup/step-1-identity', icon: <Settings size={18} /> },
]

const employeeNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Identity', href: '/dashboard/identity', icon: <BookOpen size={18} /> },
  { label: 'Culture', href: '/dashboard/culture', icon: <Heart size={18} /> },
  { label: 'Org Chart', href: '/dashboard/org-chart', icon: <GitBranch size={18} /> },
  { label: 'My Role', href: '/dashboard/my-role', icon: <Briefcase size={18} /> },
  { label: 'My Profile', href: '/dashboard/my-profile', icon: <UserCircle size={18} /> },
]

const navByRole: Record<UserRole, NavItem[]> = {
  super_admin: superAdminNav,
  org_admin: orgStaffNav,
  hr_manager: orgStaffNav,
  employee: employeeNav,
}

// ─── Role label helper ────────────────────────────────────────────────────────

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar({ role }: SidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const navItems = navByRole[role] ?? orgStaffNav

  const isActive = (href: string): boolean => {
    // Exact match for root-level dashboard entries
    if (href === '/dashboard' || href === '/super-admin') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0F172A] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-white/10 shrink-0">
        <span className="text-white font-bold text-xl tracking-tight select-none">
          OrgOS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-[#F1F5F9]',
              ].join(' ')}
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/10 p-4 flex flex-col gap-3">
        {user && (
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">
              {user.name}
            </p>
            <span className="inline-flex self-start items-center rounded-[999px] bg-[#1E293B] text-[#94A3B8] text-[11px] font-medium px-2 py-0.5">
              {roleLabels[role]}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full rounded-[8px] px-3 py-2 text-sm text-[#CBD5E1] hover:text-white hover:bg-[#1E293B] transition-colors duration-150"
        >
          <LogOut size={16} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
