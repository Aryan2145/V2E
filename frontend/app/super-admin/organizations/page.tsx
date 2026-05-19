'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ArrowRight, Plus } from 'lucide-react'
import { getOrganizations } from '@/lib/api/organizations'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { Organization, OrgStatus } from '@/lib/types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function orgStatusToBadge(status: OrgStatus): 'active' | 'inactive' | 'pending' {
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  return 'pending'
}

function orgStatusLabel(status: OrgStatus): string {
  if (status === 'active') return 'Active'
  if (status === 'inactive') return 'Inactive'
  return 'Pending Setup'
}

// ─── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[#E2E8F0]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 rounded-md bg-[#E2E8F0] animate-pulse" style={{ width: `${[140, 80, 110, 80, 70, 60][i - 1]}px` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getOrganizations()
      .then((data) => { if (!cancelled) setOrgs(data) })
      .catch(() => { if (!cancelled) setError('Failed to load organizations.') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Organizations</h1>
          <p className="text-sm text-[#475569] mt-1">Manage all tenant organizations on the platform.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => router.push('/super-admin/organizations/new')}
        >
          <Plus size={16} />
          New Organization
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {['Name', 'Slug', 'Industry', 'Country', 'Status', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!isLoading && error && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[#DC2626] text-sm">
                  {error}
                </td>
              </tr>
            )}

            {!isLoading && !error && orgs.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center">
                      <Building2 size={22} className="text-[#94A3B8]" />
                    </div>
                    <p className="text-[#475569] font-medium">No organizations yet</p>
                    <p className="text-[#94A3B8] text-xs">Click "New Organization" to add one.</p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !error && orgs.map((org) => (
              <tr
                key={org.id}
                className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-[#2563EB]" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-[#0F172A]">{org.name}</span>
                      {org.group && (
                        <span className="inline-flex self-start items-center rounded-[999px] bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] text-[11px] font-medium px-2 py-0.5">
                          {org.group.name}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#475569] font-mono text-xs">{org.slug}</td>
                <td className="px-6 py-4 text-[#475569]">{org.industry ?? '—'}</td>
                <td className="px-6 py-4 text-[#475569]">{org.country ?? '—'}</td>
                <td className="px-6 py-4">
                  <Badge
                    status={orgStatusToBadge(org.status)}
                    label={orgStatusLabel(org.status)}
                  />
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => router.push(`/super-admin/organizations/${org.id}`)}
                    className="inline-flex items-center gap-1 text-[#2563EB] text-sm font-medium hover:text-[#1D4ED8] transition-colors"
                  >
                    View <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
