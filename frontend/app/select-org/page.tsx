'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ArrowRight, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import type { OrgChoice } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Org Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
}

const ROLE_COLORS: Record<string, string> = {
  org_admin: 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]',
  hr_manager: 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]',
  employee: 'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]',
}

export default function SelectOrgPage() {
  const { pendingOrgSelection, selectOrg, logout, user } = useAuth()
  const router = useRouter()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Redirect if already authenticated or no pending orgs
  useEffect(() => {
    if (user) {
      router.replace(user.isSuperAdmin ? '/super-admin/organizations' : '/dashboard')
    }
  }, [user, router])

  // If there are no pending orgs and no user, go to login
  useEffect(() => {
    if (!pendingOrgSelection) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('selection_token') : null
      if (!token) router.replace('/login')
    }
  }, [pendingOrgSelection, router])

  const orgs: OrgChoice[] = pendingOrgSelection ?? []

  const filtered = search.trim()
    ? orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : orgs

  async function handleSelect(orgId: string) {
    setSelecting(orgId)
    setError(null)
    try {
      await selectOrg(orgId)
    } catch {
      setError('Failed to switch organization. Please try again.')
      setSelecting(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[640px]">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-[28px] font-bold text-[#0F172A] tracking-tight">OrgOS</span>
          <h1 className="mt-4 text-[22px] font-semibold text-[#0F172A]">Select an Organization</h1>
          <p className="mt-1 text-[15px] text-[#475569]">
            You belong to multiple organizations. Choose one to enter.
          </p>
        </div>

        {/* Search (show when > 5 orgs) */}
        {orgs.length > 5 && (
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search organizations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-[44px] px-4 text-[15px] text-[#0F172A] placeholder-[#94A3B8] bg-white border border-[#CBD5E1] rounded-[8px] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-[8px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        {/* Org Cards */}
        <div className="flex flex-col gap-3">
          {filtered.map((org) => {
            const isSelecting = selecting === org.id
            return (
              <button
                key={org.id}
                onClick={() => handleSelect(org.id)}
                disabled={!!selecting}
                className="group w-full flex items-center gap-4 p-5 bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[#2563EB] hover:shadow-[0_2px_8px_rgba(37,99,235,0.12)] transition-all duration-150 text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Org icon */}
                <div className="w-12 h-12 rounded-[10px] bg-[#EFF6FF] flex items-center justify-center shrink-0 group-hover:bg-[#DBEAFE] transition-colors">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="w-8 h-8 object-contain rounded" />
                  ) : (
                    <Building2 size={22} className="text-[#2563EB]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#0F172A] truncate">{org.name}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${ROLE_COLORS[org.role] ?? ROLE_COLORS.employee}`}>
                      {ROLE_LABELS[org.role] ?? org.role}
                    </span>
                    <span className="text-[13px] text-[#94A3B8]">
                      Since {new Date(org.joined_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-[#94A3B8] group-hover:text-[#2563EB] transition-colors">
                  {isSelecting ? (
                    <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRight size={20} />
                  )}
                </div>
              </button>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#475569]">No organizations match your search.</div>
          )}
        </div>

        {/* Sign out link */}
        <div className="mt-8 text-center">
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
