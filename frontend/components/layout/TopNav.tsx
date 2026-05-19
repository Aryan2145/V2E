'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ChevronDown, Building2, Check } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMyOrgs } from '@/lib/api/auth'
import type { OrgMembership } from '@/lib/types'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Foundation', href: '/foundation' },
  { label: 'Goals', href: '/goals' },
  { label: 'Learning', href: '/learning' },
  { label: 'Communication', href: '/communication' },
]

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Org Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
  super_admin: 'Super Admin',
}

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, switchOrg } = useAuth()

  const [open, setOpen] = useState(false)
  const [orgs, setOrgs] = useState<OrgMembership[] | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Load orgs for multi-org switcher
  useEffect(() => {
    if (user && !user.isSuperAdmin && user.organizationId) {
      getMyOrgs().then(setOrgs).catch(() => setOrgs([]))
    }
  }, [user?.organizationId])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
    return pathname.startsWith(href)
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const roleLabel = user?.isSuperAdmin
    ? 'Super Admin'
    : user?.role
      ? (ROLE_LABELS[user.role] ?? user.role.replace(/_/g, ' '))
      : ''

  const currentOrg = orgs?.find((m) => m.organization_id === user?.organizationId)
  const otherOrgs = orgs?.filter((m) => m.organization_id !== user?.organizationId) ?? []

  async function handleSwitch(orgId: string) {
    setSwitching(orgId)
    try {
      await switchOrg(orgId)
      setOpen(false)
      router.push('/dashboard')
    } catch {
      // ignore
    } finally {
      setSwitching(null)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#E2E8F0] flex items-center z-50">
      {/* Brand */}
      <div className="w-[200px] shrink-0 px-6">
        <span className="text-[#0F172A] font-bold text-lg tracking-tight select-none">OrgOS</span>
      </div>

      {/* Nav tabs */}
      <nav className="flex items-stretch flex-1 h-full">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'relative px-5 flex items-center text-sm font-medium transition-colors duration-150',
                active ? 'text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]',
              ].join(' ')}
            >
              {item.label}
              {active && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#2563EB] rounded-t-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      {user && (
        <div className="relative px-6 shrink-0" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 hover:bg-[#F1F5F9] transition-colors"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[#0F172A] leading-tight">{user.name}</p>
              <p className="text-xs text-[#64748B] leading-tight">
                {currentOrg?.organization.name
                  ? `${currentOrg.organization.name} · ${roleLabel}`
                  : roleLabel}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <ChevronDown
              size={14}
              className={`text-[#94A3B8] shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-4 top-[calc(100%+6px)] w-64 bg-white rounded-[10px] border border-[#E2E8F0] shadow-lg overflow-hidden z-50">
              {/* User identity */}
              <div className="px-4 py-3 border-b border-[#F1F5F9]">
                <p className="text-sm font-semibold text-[#0F172A] truncate">{user.name}</p>
                <p className="text-xs text-[#64748B] truncate">{user.email}</p>
              </div>

              {/* Org section — hidden for super admin */}
              {!user.isSuperAdmin && user.organizationId && (
                <>
                  {/* Current org */}
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                      Current Organization
                    </p>
                    {orgs === null ? (
                      <div className="flex items-center gap-2 py-1.5">
                        <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-[#64748B]">Loading…</span>
                      </div>
                    ) : currentOrg ? (
                      <div className="flex items-center gap-2.5 py-1">
                        <div className="w-6 h-6 rounded-[5px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
                          <Building2 size={13} className="text-[#2563EB]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0F172A] truncate">{currentOrg.organization.name}</p>
                          <p className="text-xs text-[#64748B]">{ROLE_LABELS[currentOrg.role] ?? currentOrg.role}</p>
                        </div>
                        <Check size={14} className="text-[#2563EB] shrink-0" />
                      </div>
                    ) : null}
                  </div>

                  {/* Other orgs */}
                  {otherOrgs.length > 0 && (
                    <div className="px-4 pt-2 pb-1 border-t border-[#F1F5F9] mt-1">
                      <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                        Switch To
                      </p>
                      {otherOrgs.map((m) => {
                        const isLoading = switching === m.organization_id
                        return (
                          <button
                            key={m.organization_id}
                            onClick={() => handleSwitch(m.organization_id)}
                            disabled={!!switching}
                            className="w-full flex items-center gap-2.5 py-2 rounded-[6px] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors text-left px-1"
                          >
                            <div className="w-6 h-6 rounded-[5px] bg-[#F1F5F9] flex items-center justify-center shrink-0">
                              <Building2 size={13} className="text-[#64748B]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#0F172A] truncate">{m.organization.name}</p>
                              <p className="text-xs text-[#64748B]">{ROLE_LABELS[m.role] ?? m.role}</p>
                            </div>
                            {isLoading && (
                              <div className="w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Sign out */}
              <div className="border-t border-[#F1F5F9] p-2">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-sm text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
