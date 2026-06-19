'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { getRoles } from '@/lib/api/roles'
import { getDepartments } from '@/lib/api/departments'
import type { Role, Department, RoleLevel } from '@/lib/types'
import { Search, Briefcase, ChevronRight } from 'lucide-react'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

// ─── Level badge ──────────────────────────────────────────────────────────────

const levelConfig: Record<
  RoleLevel,
  { label: string; bg: string; text: string }
> = {
  junior: { label: 'Junior', bg: 'bg-[#F1F5F9]', text: 'text-[#475569]' },
  mid: { label: 'Mid', bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]' },
  senior: { label: 'Senior', bg: 'bg-[#F3E8FF]', text: 'text-[#7C3AED]' },
  lead: { label: 'Lead', bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]' },
  head: { label: 'Head', bg: 'bg-[#1E293B]', text: 'text-[#F1F5F9]' },
}

function LevelBadge({ level }: { level: RoleLevel }) {
  const cfg = levelConfig[level] ?? levelConfig.mid
  return (
    <span
      className={`inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <Briefcase size={24} className="text-[#94A3B8]" />
      </div>
      <p className="font-semibold text-[#0F172A]">
        {filtered ? 'No roles match your filter' : 'No roles defined yet'}
      </p>
      <p className="text-[#475569] text-sm mt-1">
        {filtered
          ? 'Try adjusting your search or department filter.'
          : 'Roles will appear here once created in the setup wizard.'}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    Promise.all([
      getRoles(orgId).catch(() => []),
      getDepartments(orgId).catch(() => []),
    ]).then(([r, d]) => {
      setRoles(r)
      setDepartments(d)
    }).finally(() => setLoading(false))
  }, [orgId])

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {}
    departments.forEach((d) => { m[d.id] = d.name })
    return m
  }, [departments])

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      const matchesDept = deptFilter === 'all' || r.department_id === deptFilter
      const matchesSearch =
        !search || r.title.toLowerCase().includes(search.toLowerCase())
      return matchesDept && matchesSearch
    })
  }, [roles, deptFilter, search])

  const columns: ResponsiveColumn<Role>[] = [
    {
      key: 'title',
      header: 'Title',
      primary: true,
      cellClassName: 'px-6 py-4 font-medium text-[#0F172A]',
      headerClassName: 'px-6 py-3.5',
      render: (role) => role.title,
    },
    {
      key: 'department',
      header: 'Department',
      desktopHiddenBelow: 'md',
      cellClassName: 'px-6 py-4 text-[#475569]',
      headerClassName: 'px-6 py-3.5',
      render: (role) => deptMap[role.department_id] ?? role.department?.name ?? '—',
    },
    {
      key: 'level',
      header: 'Level',
      cellClassName: 'px-6 py-4',
      headerClassName: 'px-6 py-3.5',
      render: (role) => <LevelBadge level={role.level} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cellClassName: 'px-6 py-4',
      headerClassName: 'px-6 py-3.5',
      render: (role) => (
        <Link
          href={`/settings/organization/roles/${role.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[#2563EB] text-xs font-medium hover:text-[#1D4ED8] transition-colors"
        >
          View
          <ChevronRight size={13} />
        </Link>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Roles</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Browse all roles, their levels, and associated departments.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            type="text"
            placeholder="Search roles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-[10px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
          />
        </div>

        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-[10px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-[#475569]">
        {filtered.length} role{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Table */}
      <ResponsiveTable
        columns={columns}
        rows={filtered}
        rowKey={(role) => role.id}
        onRowClick={(role) => { window.location.href = `/settings/organization/roles/${role.id}` }}
        emptyState={<EmptyState filtered={search !== '' || deptFilter !== 'all'} />}
      />
    </div>
  )
}
