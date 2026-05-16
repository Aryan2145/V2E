'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { getEmployee, getEmployees } from '@/lib/api/employees'
import Button from '@/components/ui/Button'
import type { EmployeeProfile, EmployeeStatus } from '@/lib/types'
import { ArrowLeft, Users, ChevronDown } from 'lucide-react'

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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
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
      className={`inline-flex items-center rounded-[999px] px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  )
}

// ─── Info cell ─────────────────────────────────────────────────────────────────

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm text-[#1E293B] font-medium">{value ?? '—'}</p>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
      <h2 className="text-base font-semibold text-[#0F172A] mb-4 pb-3 border-b border-[#F1F5F9]">
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Reporting chain ──────────────────────────────────────────────────────────

function ReportingChain({
  emp,
  allEmployees,
}: {
  emp: EmployeeProfile
  allEmployees: EmployeeProfile[]
}) {
  const chain: EmployeeProfile[] = []
  let current = emp
  let depth = 0

  while (current.reporting_to_user_id && depth < 5) {
    const manager = allEmployees.find((e) => e.user_id === current.reporting_to_user_id)
    if (!manager) break
    chain.push(manager)
    current = manager
    depth++
  }

  if (chain.length === 0) {
    return (
      <p className="text-sm text-[#94A3B8] italic">No reporting chain found.</p>
    )
  }

  return (
    <div className="space-y-2">
      {chain.map((mgr, i) => {
        const name = mgr.user?.name ?? 'Unknown'
        return (
          <div key={mgr.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
              >
                {getInitials(name)}
              </div>
              {i < chain.length - 1 && (
                <div className="w-px h-4 bg-[#E2E8F0] mt-1" />
              )}
            </div>
            <div className="pt-1">
              <Link
                href={`/dashboard/employees/${mgr.id}`}
                className="text-sm font-semibold text-[#0F172A] hover:text-[#2563EB] transition-colors"
              >
                {name}
              </Link>
              <p className="text-xs text-[#475569]">{mgr.role?.title ?? 'N/A'}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  const params = useParams()
  const employeeId = params?.employeeId as string
  const { user } = useAuth()
  const orgId = user?.organization_id ?? ''

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null)
  const [allEmployees, setAllEmployees] = useState<EmployeeProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!orgId || !employeeId) {
      setLoading(false)
      return
    }
    Promise.all([
      getEmployee(orgId, employeeId).catch(() => null),
      getEmployees(orgId).catch(() => []),
    ]).then(([empData, allEmps]) => {
      if (!empData) {
        setError(true)
      } else {
        setEmployee(empData)
      }
      setAllEmployees(allEmps)
    }).finally(() => setLoading(false))
  }, [orgId, employeeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users size={36} className="text-[#94A3B8] mb-3" />
        <p className="text-lg font-semibold text-[#0F172A]">Employee not found</p>
        <Link href="/dashboard/employees" className="mt-4">
          <Button variant="secondary" size="sm">
            <ArrowLeft size={14} /> Back to employees
          </Button>
        </Link>
      </div>
    )
  }

  const name = employee.user?.name ?? 'Unknown'
  const email = employee.user?.email ?? ''

  const employmentTypeLabels: Record<string, string> = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
  }

  const jdPreview = employee.role?.job_description
    ? employee.role.job_description.slice(0, 200) +
      (employee.role.job_description.length > 200 ? '…' : '')
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link
        href="/dashboard/employees"
        className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors"
      >
        <ArrowLeft size={15} />
        All Employees
      </Link>

      {/* Profile header */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Large avatar */}
          <div
            className={`w-20 h-20 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-2xl font-bold flex-shrink-0`}
          >
            {getInitials(name)}
          </div>

          {/* Name + role + status */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">{name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {employee.role?.title && (
                <span className="text-sm text-[#475569] font-medium">
                  {employee.role.title}
                </span>
              )}
              {employee.department?.name && (
                <>
                  <span className="text-[#CBD5E1]">·</span>
                  <span className="inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-xs font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                    {employee.department.name}
                  </span>
                </>
              )}
              <StatusBadge status={employee.status} />
            </div>
            {email && (
              <p className="text-sm text-[#475569] mt-1">{email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <Section title="Employment Details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <InfoCell label="Employee Code" value={employee.employee_code} />
          <InfoCell label="Date of Joining" value={formatDate(employee.date_of_joining)} />
          <InfoCell
            label="Employment Type"
            value={employmentTypeLabels[employee.employment_type] ?? employee.employment_type}
          />
          <InfoCell label="Status" value={<StatusBadge status={employee.status} />} />
        </div>
      </Section>

      {/* Reports To */}
      {employee.reporting_to && (
        <Section title="Reports To">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${avatarColor(employee.reporting_to.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
            >
              {getInitials(employee.reporting_to.name)}
            </div>
            <div>
              <p className="font-semibold text-[#0F172A] text-sm">
                {employee.reporting_to.name}
              </p>
              <p className="text-xs text-[#475569]">{employee.reporting_to.email}</p>
            </div>
          </div>
        </Section>
      )}

      {/* Reporting chain */}
      <Section title="Reporting Chain">
        <ReportingChain emp={employee} allEmployees={allEmployees} />
      </Section>

      {/* Role section */}
      {employee.role && (
        <Section title="Role">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-[#0F172A]">{employee.role.title}</h3>
              {employee.role.level && (
                <span className="inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-xs font-medium bg-[#DBEAFE] text-[#1D4ED8]">
                  {employee.role.level.charAt(0).toUpperCase() + employee.role.level.slice(1)}
                </span>
              )}
            </div>

            {jdPreview && (
              <p className="text-sm text-[#475569] leading-relaxed">{jdPreview}</p>
            )}

            <Link
              href={`/dashboard/roles/${employee.role_id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              View full role
              <ChevronDown size={12} className="-rotate-90" />
            </Link>
          </div>
        </Section>
      )}

      {/* KRA summary */}
      {employee.role?.kra && employee.role.kra.length > 0 && (
        <Section title="Key Result Areas">
          <ol className="space-y-3">
            {employee.role.kra.map((kra, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-bold text-[#2563EB]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-[#0F172A] text-sm">{kra.title}</p>
                  {kra.description && (
                    <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                      {kra.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* KPI summary */}
      {employee.role?.kpi && employee.role.kpi.length > 0 && (
        <Section title="Key Performance Indicators">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-2.5 pr-4 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left py-2.5 pr-4 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-left py-2.5 pr-4 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Target
                  </th>
                  <th className="text-left py-2.5 text-xs font-semibold text-[#475569] uppercase tracking-wider">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {employee.role.kpi.map((kpi, i) => (
                  <tr key={i}>
                    <td className="py-3 pr-4 font-medium text-[#0F172A]">{kpi.title}</td>
                    <td className="py-3 pr-4 text-[#475569]">{kpi.metric}</td>
                    <td className="py-3 pr-4 text-[#475569]">{kpi.target}</td>
                    <td className="py-3 text-[#475569]">{kpi.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
