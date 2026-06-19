'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, FileText, Search, BookOpen, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getPolicies } from '@/lib/api/company-policy'
import type { CompanyPolicy, PolicyStatus } from '@/lib/types/company-policy'

const STATUS_CONFIG: Record<PolicyStatus, { bg: string; text: string; label: string }> = {
  draft:     { bg: 'bg-[#FEF9C3]', text: 'text-[#CA8A04]', label: 'Draft' },
  published: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Published' },
  archived:  { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', label: 'Archived' },
}

function StatusBadge({ status }: { status: PolicyStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function PolicyCard({ policy }: { policy: CompanyPolicy }) {
  return (
    <Link
      href={`/dashboard/ecs/company-policy/${policy.id}`}
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 hover:border-[#2563EB] hover:shadow-md transition-all duration-150 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <FileText size={18} className="text-[#2563EB]" />
        </div>
        <StatusBadge status={policy.status} />
      </div>
      <div className="flex-1">
        <h3 className="text-[15px] font-semibold text-[#0F172A] leading-snug line-clamp-2">{policy.title}</h3>
        {policy.description && (
          <p className="text-[13px] text-[#475569] mt-1 line-clamp-2 leading-relaxed">{policy.description}</p>
        )}
      </div>
      <div className="flex items-center gap-4 pt-1 border-t border-[#F1F5F9]">
        <span className="flex items-center gap-1.5 text-[12px] text-[#64748B]">
          <BookOpen size={13} />
          {policy._count?.items ?? 0} items
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-[#64748B]">
          <Users size={13} />
          {policy._count?.assignments ?? 0} assigned
        </span>
      </div>
    </Link>
  )
}

export default function CompanyPolicyPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const isAdminOrHR = !!user?.is_admin

  const [policies, setPolicies] = useState<CompanyPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | PolicyStatus>('all')

  useEffect(() => {
    if (!orgId) return
    getPolicies(orgId).then(setPolicies).finally(() => setLoading(false))
  }, [orgId])

  const filtered = policies.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Company Policy</h1>
          <p className="text-[13px] text-[#475569] mt-0.5">{policies.length} polic{policies.length !== 1 ? 'ies' : 'y'} total</p>
        </div>
        {isAdminOrHR && (
          <Link
            href="/dashboard/ecs/company-policy/new"
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 rounded-[8px] transition-colors"
          >
            <Plus size={16} />
            New Policy
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder="Search policies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#CBD5E1] rounded-[8px] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>
        {(['all', 'draft', 'published', 'archived'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              'px-3 py-1.5 rounded-[6px] text-xs font-medium capitalize transition-colors',
              filter === s
                ? 'bg-[#2563EB] text-white'
                : 'bg-white text-[#475569] border border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB]',
            ].join(' ')}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s as PolicyStatus].label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-[#F1F5F9] rounded-[12px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-[14px] bg-[#EFF6FF] flex items-center justify-center mb-4">
            <FileText size={24} className="text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#0F172A] mb-1">No policies found</h3>
          <p className="text-sm text-[#475569] mb-4">
            {search || filter !== 'all' ? 'Try adjusting your filters.' : 'Create your first company policy to get started.'}
          </p>
          {isAdminOrHR && !search && filter === 'all' && (
            <Link
              href="/dashboard/ecs/company-policy/new"
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 rounded-[8px] transition-colors"
            >
              <Plus size={16} />
              New Policy
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  )
}
