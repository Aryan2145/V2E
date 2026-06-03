'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2,
  ChevronLeft,
  Globe,
  Clock,
  Users,
  Layers,
  Shield,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react'
import { getOrganization, deactivateOrganization } from '@/lib/api/organizations'
import { getRoles } from '@/lib/api/roles'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import type { OrgDetail, OrgStatus } from '@/lib/types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function orgStatusToBadge(status: OrgStatus): 'active' | 'inactive' | 'pending' {
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  return 'pending'
}

function orgStatusLabel(status: OrgStatus) {
  if (status === 'active') return 'Active'
  if (status === 'inactive') return 'Inactive'
  return 'Pending Setup'
}

function roleBadgeStatus(role: string): 'active' | 'inactive' | 'pending' | 'info' {
  if (role === 'org_admin') return 'info'
  if (role === 'hr_manager') return 'pending'
  if (role === 'employee') return 'active'
  return 'inactive'
}

function roleBadgeLabel(role: string) {
  return role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-[#94A3B8]">{icon}</div>
      <div>
        <p className="text-xs text-[#94A3B8] uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm text-[#0F172A] font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-[#F8FAFC] rounded-[10px] border border-[#E2E8F0] px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#0F172A]">{value}</p>
        <p className="text-xs text-[#475569]">{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const router = useRouter()

  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [roleCount, setRoleCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false

    Promise.allSettled([getOrganization(orgId), getRoles(orgId)])
      .then(([orgResult, rolesResult]) => {
        if (cancelled) return
        if (orgResult.status === 'fulfilled') setOrg(orgResult.value)
        if (rolesResult.status === 'fulfilled') setRoleCount(rolesResult.value.length)
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [orgId])

  const handleDeactivate = async () => {
    if (!orgId) return
    setIsDeactivating(true)
    setDeactivateError(null)
    try {
      await deactivateOrganization(orgId)
      setOrg((prev) => prev ? { ...prev, status: 'inactive' } : prev)
      setShowConfirm(false)
    } catch (err: any) {
      setDeactivateError(err?.response?.data?.message ?? 'Failed to deactivate.')
    } finally {
      setIsDeactivating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-7 w-48 rounded-md bg-[#E2E8F0] animate-pulse" />
        <div className="h-40 rounded-[12px] bg-[#E2E8F0] animate-pulse" />
        <div className="h-64 rounded-[12px] bg-[#E2E8F0] animate-pulse" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-[#475569]">Organization not found.</p>
        <Button variant="secondary" onClick={() => router.push('/super-admin/organizations')}>
          Back to list
        </Button>
      </div>
    )
  }

  const members = org.members ?? []
  const memberCount = org._count?.members ?? members.length
  const deptCount = org._count?.departments ?? 0

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/super-admin/organizations')}
          className="inline-flex items-center gap-1 text-sm text-[#475569] hover:text-[#0F172A] mb-3 transition-colors"
        >
          <ChevronLeft size={16} /> Organizations
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold text-[#0F172A]">{org.name}</h1>
          {org.status === 'active' && (
            <Button variant="danger" onClick={() => setShowConfirm(true)}>
              <AlertTriangle size={15} />
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Org info card */}
      <Card>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-[12px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <Building2 size={26} className="text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-[#0F172A]">{org.name}</h2>
              <Badge status={orgStatusToBadge(org.status)} label={orgStatusLabel(org.status)} />
              {org.is_test && (
                <span className="inline-flex items-center gap-1 rounded-[999px] bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[11px] font-semibold px-2.5 py-0.5">
                  <FlaskConical size={11} /> TEST
                </span>
              )}
              {org.group && (
                <button
                  onClick={() => router.push(`/super-admin/groups/${org.group!.id}`)}
                  className="inline-flex items-center gap-1 rounded-[999px] bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] text-[11px] font-medium px-2.5 py-0.5 hover:bg-[#BAE6FD] transition-colors"
                >
                  <Layers size={11} />
                  {org.group.name}
                </button>
              )}
            </div>
            <p className="text-sm text-[#94A3B8] font-mono mt-0.5">{org.slug}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 pt-5 border-t border-[#E2E8F0]">
          <InfoRow icon={<Layers size={16} />} label="Industry" value={org.industry ?? '—'} />
          <InfoRow icon={<Globe size={16} />} label="Country" value={org.country ?? '—'} />
          <InfoRow icon={<Clock size={16} />} label="Timezone" value={org.timezone ?? '—'} />
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Users size={18} />} label="Members" value={memberCount} />
        <StatCard icon={<Layers size={18} />} label="Departments" value={deptCount} />
        <StatCard icon={<Shield size={18} />} label="Roles" value={roleCount} />
      </div>

      {/* Members table */}
      <Card title="Members">
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Users size={28} className="text-[#CBD5E1]" />
            <p className="text-sm text-[#94A3B8]">No members in this organization yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  {['Name', 'Email', 'Role', 'Also In', 'Status'].map((col) => (
                    <th key={col} className="py-2 pr-4 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-[#E2E8F0] last:border-0">
                    <td className="py-3 pr-4 font-medium text-[#0F172A]">{m.user.name}</td>
                    <td className="py-3 pr-4 text-[#475569]">{m.user.email}</td>
                    <td className="py-3 pr-4">
                      <Badge status={roleBadgeStatus(m.role) as any} label={roleBadgeLabel(m.role)} />
                    </td>
                    <td className="py-3 pr-4">
                      {m.also_in.length === 0 ? (
                        <span className="text-[#94A3B8] text-xs">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {m.also_in.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => router.push(`/super-admin/organizations/${o.id}`)}
                              className="inline-flex items-center rounded-[999px] bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] text-[11px] font-medium px-2 py-0.5 hover:bg-[#BAE6FD] transition-colors"
                            >
                              {o.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        status={m.user.is_active ? 'active' : 'inactive'}
                        label={m.user.is_active ? 'Active' : 'Inactive'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Deactivate confirm modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setDeactivateError(null) }}
        title="Deactivate Organization"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FECACA]">
            <AlertTriangle size={18} className="text-[#DC2626] shrink-0 mt-0.5" />
            <p className="text-sm text-[#7F1D1D]">
              Deactivating <strong>{org.name}</strong> will prevent all its users from
              accessing V2E. This action can be reversed by re-activating the organization.
            </p>
          </div>
          {deactivateError && <p className="text-sm text-[#DC2626]">{deactivateError}</p>}
          <div className="flex gap-3 pt-1">
            <Button variant="danger" isLoading={isDeactivating} onClick={handleDeactivate}>Deactivate</Button>
            <Button
              variant="secondary"
              onClick={() => { setShowConfirm(false); setDeactivateError(null) }}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
