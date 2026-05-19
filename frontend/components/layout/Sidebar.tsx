'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  ChevronUp,
  Check,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMyOrgs } from '@/lib/api/auth'
import type { UserRole, OrgMembership } from '@/lib/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarProps {
  role: UserRole
  orgId?: string
}

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

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
}

export default function Sidebar({ role }: SidebarProps) {
  const { user, logout, switchOrg } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false)
  const [orgs, setOrgs] = useState<OrgMembership[] | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)

  const navItems = navByRole[role] ?? orgStaffNav

  // Eagerly load orgs so the current org name is visible without opening the switcher
  useEffect(() => {
    if (user && !user.isSuperAdmin && user.organizationId) {
      getMyOrgs().then(setOrgs).catch(() => setOrgs([]))
    }
  }, [user?.organizationId])

  const isActive = (href: string): boolean => {
    if (href === '/dashboard' || href === '/super-admin') return pathname === href
    return pathname.startsWith(href)
  }

  function handleOrgSwitcherOpen() {
    setShowOrgSwitcher((v) => !v)
  }

  async function handleOrgSwitch(orgId: string) {
    if (orgId === user?.organizationId) {
      setShowOrgSwitcher(false)
      return
    }
    setSwitching(orgId)
    try {
      await switchOrg(orgId)
      setShowOrgSwitcher(false)
      router.push('/dashboard')
    } catch {
      // ignore
    } finally {
      setSwitching(null)
    }
  }

  const currentOrgName = orgs?.find((m) => m.organization_id === user?.organizationId)?.organization?.name

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-[#0F172A] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-white/10 shrink-0">
        <span className="text-white font-bold text-xl tracking-tight select-none">V2E</span>
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

      {/* Org Switcher (only for org members, not super_admin) */}
      {user && !user.isSuperAdmin && user.organizationId && (
        <div className="shrink-0 border-t border-white/10">
          <button
            onClick={handleOrgSwitcherOpen}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1E293B] transition-colors"
          >
            <div className="w-7 h-7 rounded-[6px] bg-[#2563EB] flex items-center justify-center shrink-0">
              <Building2 size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] text-[#64748B] leading-none mb-0.5">Organization</p>
              <p className="text-[13px] text-[#CBD5E1] font-medium truncate leading-tight">
                {currentOrgName ?? '—'}
              </p>
            </div>
            <ChevronUp
              size={14}
              className={`text-[#64748B] shrink-0 transition-transform ${showOrgSwitcher ? '' : 'rotate-180'}`}
            />
          </button>

          {/* Dropdown */}
          {showOrgSwitcher && (
            <div className="mx-3 mb-2 bg-[#1E293B] rounded-[8px] overflow-hidden">
              {!orgs ? (
                <div className="px-3 py-4 text-center">
                  <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : orgs.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-[#64748B]">No other organizations</p>
              ) : (
                orgs.map((m) => {
                  const isCurrent = m.organization_id === user.organizationId
                  const isLoading = switching === m.organization_id
                  return (
                    <button
                      key={m.organization_id}
                      onClick={() => handleOrgSwitch(m.organization_id)}
                      disabled={!!switching}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#0F172A]/60 transition-colors disabled:opacity-60"
                    >
                      <div className="w-6 h-6 rounded-[4px] bg-[#0F172A] flex items-center justify-center shrink-0">
                        <Building2 size={12} className="text-[#64748B]" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[12px] text-[#CBD5E1] font-medium truncate">{m.organization.name}</p>
                        <p className="text-[11px] text-[#64748B] capitalize">{roleLabels[m.role] ?? m.role}</p>
                      </div>
                      {isCurrent && !isLoading && <Check size={12} className="text-[#2563EB] shrink-0" />}
                      {isLoading && <div className="w-3 h-3 border border-[#2563EB] border-t-transparent rounded-full animate-spin shrink-0" />}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

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
