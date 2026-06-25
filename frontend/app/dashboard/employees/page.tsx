'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getEmployees } from '@/lib/api/employees'
import { getDepartments } from '@/lib/api/departments'
import { getRoles } from '@/lib/api/roles'
import type { EmployeeProfile, Department, Role, EmployeeStatus } from '@/lib/types'
import { Search, Users, ChevronRight, UserPlus, Upload } from 'lucide-react'
import AddEmployeeModal from '@/components/employees/AddEmployeeModal'
import ImportEmployeesModal from '@/components/employees/ImportEmployeesModal'
import DepartmentSelect from '@/components/employees/DepartmentSelect'
import EmployeeTreeView from '@/components/employees/EmployeeTreeView'
import ViewToggle, { type EmployeeView } from '@/components/employees/ViewToggle'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

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
  const router = useRouter()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const canManage = !!user?.is_admin

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [view, setView] = useState<EmployeeView>('table')
  const tableScrollRef = useRef<HTMLDivElement>(null)

  // Restore the view + filters when returning here (e.g. browser back from a
  // profile), so the user lands on the same screen they left rather than the
  // default table.
  useEffect(() => {
    const v = sessionStorage.getItem('employees-view')
    if (v === 'tree' || v === 'table') setView(v)
    const s = sessionStorage.getItem('employees-search')
    if (s) setSearch(s)
    const d = sessionStorage.getItem('employees-dept')
    if (d) setDeptFilter(d)
  }, [])
  useEffect(() => {
    sessionStorage.setItem('employees-view', view)
  }, [view])
  useEffect(() => {
    sessionStorage.setItem('employees-search', search)
  }, [search])
  useEffect(() => {
    sessionStorage.setItem('employees-dept', deptFilter)
  }, [deptFilter])

  // ── Card (inner) scroll: save + restore ──────────────────────────────────────
  // Persist the table's own scroll position so returning from a profile keeps the
  // card where the user left it. rAF-throttled; re-attaches when the table mounts.
  useEffect(() => {
    if (loading || view !== 'table') return
    const el = tableScrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        sessionStorage.setItem('employees-scroll', String(el.scrollTop))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [loading, view])

  useEffect(() => {
    if (loading || view !== 'table') return
    const y = Number(sessionStorage.getItem('employees-scroll'))
    if (!Number.isFinite(y) || y <= 0) return
    let frame = 0
    let tries = 0
    const apply = () => {
      const el = tableScrollRef.current
      if (!el) return
      el.scrollTop = y
      tries += 1
      if (Math.abs(el.scrollTop - y) > 2 && tries < 40) {
        frame = requestAnimationFrame(apply)
      }
    }
    frame = requestAnimationFrame(apply)
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [loading, view])

  // ── Page (window) scroll: save + restore ─────────────────────────────────────
  // The page can still scroll because the header + filters + capped card exceed
  // the viewport. Kept fully independent of the card restore above so the two
  // never interfere — they target different scrollers and different storage keys.
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        sessionStorage.setItem(
          'employees-page-scroll',
          String(window.scrollY || document.documentElement.scrollTop || 0),
        )
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    const y = Number(sessionStorage.getItem('employees-page-scroll'))
    if (!Number.isFinite(y) || y <= 0) return
    let frame = 0
    let tries = 0
    const apply = () => {
      window.scrollTo(0, y)
      tries += 1
      const cur = window.scrollY || document.documentElement.scrollTop || 0
      const maxY = document.documentElement.scrollHeight - window.innerHeight
      if (Math.abs(cur - Math.min(y, maxY)) > 2 && tries < 40) {
        frame = requestAnimationFrame(apply)
      }
    }
    frame = requestAnimationFrame(apply)
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [loading])

  const reloadEmployees = useCallback(() => {
    if (!orgId) return
    getEmployees(orgId)
      .then(setEmployees)
      .catch(() => null)
  }, [orgId])

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    Promise.all([
      getEmployees(orgId).catch(() => []),
      getDepartments(orgId).catch(() => []),
      getRoles(orgId).catch(() => []),
    ]).then(([emps, depts, rls]) => {
      setEmployees(emps)
      setDepartments(depts)
      setRoles(rls)
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

  const columns: ResponsiveColumn<EmployeeProfile>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      cellClassName: 'px-6 py-4',
      headerClassName: 'px-6 py-3.5',
      render: (emp) => {
        const name = emp.user?.name ?? 'Unknown'
        const email = emp.user?.email ?? ''
        return (
          <div className="flex items-center gap-3">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="font-medium text-[#0F172A] truncate">{name}</p>
              <p className="text-xs text-[#475569] truncate">{email}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Role',
      desktopHiddenBelow: 'md',
      cellClassName: 'px-6 py-4 text-[#475569]',
      headerClassName: 'px-6 py-3.5',
      render: (emp) => emp.role?.title ?? '—',
    },
    {
      key: 'department',
      header: 'Department',
      desktopHiddenBelow: 'lg',
      cellClassName: 'px-6 py-4 text-[#475569]',
      headerClassName: 'px-6 py-3.5',
      render: (emp) => emp.department?.name ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      cellClassName: 'px-6 py-4',
      headerClassName: 'px-6 py-3.5',
      render: (emp) => <StatusBadge status={emp.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cellClassName: 'px-6 py-4',
      headerClassName: 'px-6 py-3.5',
      render: (emp) => (
        <Link
          href={`/settings/organization/employees/${emp.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-0 text-[#2563EB] text-xs font-medium hover:text-[#1D4ED8] transition-colors rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          View
          <ChevronRight size={13} />
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Employees</h1>
          <p className="mt-1 text-[15px] text-[#475569]">
            Browse and manage all employee profiles.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              <Upload size={16} />
              Import
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
            >
              <UserPlus size={16} />
              Add Employee
            </button>
          </div>
        )}
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
        <div className="w-full sm:w-60">
          <DepartmentSelect
            value={deptFilter === 'all' ? '' : deptFilter}
            onChange={(id) => setDeptFilter(id || 'all')}
            departments={departments}
            allLabel="All departments"
          />
        </div>
      </div>

      {/* Count + view toggle */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#475569]">
          {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
        </p>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {/* Table / Tree */}
      {view === 'table' ? (
        <ResponsiveTable
          columns={columns}
          rows={filtered}
          rowKey={(emp) => emp.id}
          onRowClick={(emp) => router.push(`/settings/organization/employees/${emp.id}`)}
          emptyState={<EmptyState filtered={isFiltered} />}
          maxBodyHeight="min(60vh, 560px)"
          scrollContainerRef={tableScrollRef}
        />
      ) : (
        <EmployeeTreeView employees={filtered} departments={departments} />
      )}

      {/* Add / Import modals */}
      {showAdd && (
        <AddEmployeeModal
          orgId={orgId}
          departments={departments}
          roles={roles}
          employees={employees}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            reloadEmployees()
          }}
        />
      )}
      {showImport && (
        <ImportEmployeesModal
          orgId={orgId}
          departments={departments}
          roles={roles}
          employees={employees}
          onClose={() => setShowImport(false)}
          onImported={reloadEmployees}
        />
      )}
    </div>
  )
}
