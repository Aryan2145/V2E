'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { getEmployees } from '@/lib/api/employees'
import { getDepartments } from '@/lib/api/departments'
import type { EmployeeProfile, Department, EmployeeStatus } from '@/lib/types'
import { Search, Users, ChevronRight } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const avatarColors = [
  'bg-[#2563EB]',
  'bg-[#7C3AED]',
  'bg-[#059669]',
  'bg-[#D97706]',
  'bg-[#DC2626]',
  'bg-[#0891B2]',
  'bg-[#BE185D]',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return avatarColors[hash % avatarColors.length]
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusConfig: Record<EmployeeStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Active' },
  inactive: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', label: 'Inactive' },
  on_leave: { bg: 'bg-[#FEF9C3]', text: 'text-[#CA8A04]', label: 'On Leave' },
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.inactive
  return (
    <span
      className={`inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <div
      className={`w-9 h-9 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
    >
      {getInitials(name)}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <Users size={24} className="text-[#94A3B8]" />
      </div>
      <p className="font-semibold text-[#0F172A]">
        {filtered ? 'No employees match your filter' : 'No employees yet'}
      </p>
      <p className="text-[#475569] text-sm mt-1">
        {filtered
          ? 'Try adjusting your search or department filter.'
          : 'Employees will appear here once added.'}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuth()
  const orgId = user?.organization_id ?? ''

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    Promise.all([
      getEmployees(orgId).catch(() => []),
      getDepartments(orgId).catch(() => []),
    ]).then(([emps, depts]) => {
      setEmployees(emps)
      setDepartments(depts)
    }).finally(() => setLoading(false))
  }, [orgId])

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const name = emp.user?.name ?? ''
      const email = emp.user?.email ?? ''
      const matchesDept = deptFilter === 'all' || emp.department_id === deptFilter
      const matchesSearch =
        !search ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        email.toLowerCase().includes(search.toLowerCase())
      return matchesDept && matchesSearch
    })
  }, [employees, deptFilter, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isFiltered = search !== '' || deptFilter !== 'all'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Employees</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Browse and manage all employee profiles.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-[10px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
          />
        </div>
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

      {/* Count */}
      <p className="text-sm text-[#475569]">
        {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#475569] uppercase tracking-wider hidden md:table-cell">
                  Role
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#475569] uppercase tracking-wider hidden lg:table-cell">
                  Department
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-6 py-3.5 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((emp) => {
                const name = emp.user?.name ?? 'Unknown'
                const email = emp.user?.email ?? ''
                return (
                  <tr
                    key={emp.id}
                    className="hover:bg-[#F8FAFC] transition-colors duration-100 cursor-pointer"
                    onClick={() => window.location.href = `/dashboard/employees/${emp.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0">
                          <p className="font-medium text-[#0F172A] truncate">{name}</p>
                          <p className="text-xs text-[#475569] truncate">{email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#475569] hidden md:table-cell">
                      {emp.role?.title ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-[#475569] hidden lg:table-cell">
                      {emp.department?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/employees/${emp.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[#2563EB] text-xs font-medium hover:text-[#1D4ED8] transition-colors"
                      >
                        View
                        <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
