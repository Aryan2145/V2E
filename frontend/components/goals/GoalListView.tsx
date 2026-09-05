'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Target, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'
import StyledSelect from '@/components/ui/StyledSelect'
import AccessHiddenState from '@/components/ui/AccessHiddenState'
import { goalsApi } from '@/lib/api/goals'
import { STATUS_META, formatValue, type Goal, type GoalStatus } from '@/lib/types/goals'
import CreateGoalModal from './CreateGoalModal'
import {
  CountBadge,
  DAYS_TONE,
  EmptyState,
  GoalStatusBadge,
  daysLeftLabel,
  formatDate,
  useGoalPermissions,
  useGoalRefData,
} from './shared'

const STATUSES: GoalStatus[] = [
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'closed',
]

/**
 * Goals — one flat list. No nesting and no indentation: a goal's place in the
 * web lives on its own page, because in a web there is no single "level" a row
 * could be indented to.
 */
export default function GoalListView() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = user?.organizationId ?? ''
  const { perms, loading: permsLoading } = useGoalPermissions(orgId)
  const { employees, departments } = useGoalRefData(orgId)

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('')
  const [department, setDepartment] = useState('')
  // Seeded from ?status= so the Dashboard's status tiles land pre-filtered.
  const [status, setStatus] = useState<GoalStatus | ''>(
    (searchParams.get('status') as GoalStatus) || '',
  )

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setGoals(await goalsApi.list(orgId).catch(() => []))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const deptOfOwner = useMemo(
    () => new Map(employees.map((e) => [e.user_id, e.department_id ?? ''])),
    [employees],
  )

  const filtered = useMemo(
    () =>
      goals.filter((g) => {
        if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false
        if (owner && g.owner_user_id !== owner) return false
        // A goal has no department of its own — it belongs to whichever
        // department its owner sits in, so the filter reads through them.
        if (department && deptOfOwner.get(g.owner_user_id) !== department) return false
        if (status && g.status !== status) return false
        return true
      }),
    [goals, search, owner, department, status, deptOfOwner],
  )

  const isFiltered = !!(search || owner || department || status)

  function clearFilters() {
    setSearch('')
    setOwner('')
    setDepartment('')
    setStatus('')
  }

  const columns: ResponsiveColumn<Goal>[] = [
    {
      key: 'title',
      header: 'Goal',
      primary: true,
      render: (g) => (
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#0F172A] truncate">{g.title}</p>
          {(g.supported_by_count || g.supports_count) ? (
            <p className="text-[11px] text-[#475569] mt-0.5">
              {g.supported_by_count ? `${g.supported_by_count} supporting` : ''}
              {g.supported_by_count && g.supports_count ? ' · ' : ''}
              {g.supports_count ? `supports ${g.supports_count}` : ''}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (g) => <span className="text-[14px] text-[#1E293B]">{g.owner?.name ?? '—'}</span>,
    },
    {
      key: 'due',
      header: 'Deadline',
      desktopHiddenBelow: 'md',
      render: (g) => <span className="text-[14px] text-[#1E293B]">{formatDate(g.due_date)}</span>,
    },
    {
      key: 'days',
      header: 'Days left',
      render: (g) => {
        const d = daysLeftLabel(g.days_left)
        const closed = g.status === 'achieved' || g.status === 'closed'
        return (
          <span className={`text-[13px] font-medium ${closed ? 'text-[#475569]' : DAYS_TONE[d.tone]}`}>
            {closed ? '—' : d.text}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (g) => <GoalStatusBadge status={g.status} />,
    },
    {
      key: 'number',
      header: 'Number',
      desktopHiddenBelow: 'lg',
      render: (g) =>
        g.target_value === null || g.target_value === undefined ? (
          <span className="text-[13px] text-[#475569]">—</span>
        ) : (
          <span className="text-[13px] text-[#1E293B] tabular-nums whitespace-nowrap">
            {g.current_value === null || g.current_value === undefined ? '—' : g.current_value}
            <span className="text-[#475569]"> of {formatValue(g.target_value, g.unit)}</span>
          </span>
        ),
    },
    {
      key: 'tasks',
      header: 'Tasks',
      align: 'center',
      desktopHiddenBelow: 'lg',
      render: (g) => {
        const t = g.task_counts ?? { open: 0, closed: 0 }
        if (!t.open && !t.closed) return <span className="text-[13px] text-[#475569]">—</span>
        return (
          <span className="text-[13px] whitespace-nowrap">
            <span className="font-semibold text-[#0F172A]">{t.open}</span>
            <span className="text-[#475569]"> open</span>
            <span className="text-[#CBD5E1]"> · </span>
            <span className="text-[#475569]">{t.closed} done</span>
          </span>
        )
      },
    },
    {
      key: 'last',
      header: 'Last check-in',
      desktopHiddenBelow: 'xl',
      render: (g) => (
        <span className="text-[13px] text-[#475569] whitespace-nowrap">
          {g.last_check_in_at ? formatDate(g.last_check_in_at) : 'Never'}
        </span>
      ),
    },
  ]

  if (!permsLoading && !perms.read) {
    return <AccessHiddenState orgId={orgId} leaf="goals" moduleLabel="Goals" />
  }

  return (
    <div>
      {/* Sticky header so the primary action never scrolls away — DESIGN_RULES Part 3 */}
      <div className="sticky top-0 z-20 bg-[#F8FAFC] pb-4 -mt-2 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">Goals</h1>
              <CountBadge count={filtered.length} />
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Every goal in the company. Open one to see what it needs, what it powers, and its
              check-in record.
            </p>
          </div>
          {perms.write && (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors shrink-0"
            >
              <Plus size={16} /> New goal
            </button>
          )}
        </div>

        {/* Filters — StyledSelect everywhere, never a native select */}
        <div className="flex items-center gap-2.5 flex-wrap mt-4">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals…"
              className="w-full border border-[#CBD5E1] rounded-[8px] pl-9 pr-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
          <StyledSelect
            value={status}
            onChange={(v) => setStatus(v as GoalStatus | '')}
            placeholder="All statuses"
            size="sm"
            wrapperClassName="w-[170px]"
            options={[
              { value: '', label: 'All statuses' },
              ...STATUSES.map((s) => ({
                value: s,
                label: STATUS_META[s].label,
                color: STATUS_META[s].dot,
              })),
            ]}
          />
          <StyledSelect
            value={owner}
            onChange={setOwner}
            placeholder="All owners"
            size="sm"
            wrapperClassName="w-[190px]"
            options={[
              { value: '', label: 'All owners' },
              ...employees.map((e) => ({ value: e.user_id, label: e.name })),
            ]}
          />
          <StyledSelect
            value={department}
            onChange={setDepartment}
            placeholder="All departments"
            size="sm"
            wrapperClassName="w-[190px]"
            options={[
              { value: '', label: 'All departments' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#475569] hover:text-[#0F172A] transition-colors"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      <ResponsiveTable
        columns={columns}
        rows={filtered}
        rowKey={(g) => g.id}
        onRowClick={(g) => router.push(`/goals/${g.id}`)}
        loading={loading}
        maxBodyHeight="min(66vh, 660px)"
        emptyState={
          <EmptyState
            icon={<Target size={26} />}
            title={isFiltered ? 'No goals match your filters' : 'No goals yet'}
            subtitle={
              isFiltered
                ? 'Try clearing a filter.'
                : 'Start with the outcome you actually want — the number, the owner, the date. You can link supporting goals to it afterwards.'
            }
            action={
              isFiltered ? (
                <button
                  onClick={clearFilters}
                  className="mt-1 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  Clear filters
                </button>
              ) : perms.write ? (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-1 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
                >
                  <Plus size={16} /> New goal
                </button>
              ) : undefined
            }
          />
        }
      />

      <CreateGoalModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId}
        employees={employees}
        defaultOwnerId={user?.id}
        onCreated={(g) => router.push(`/goals/${g.id}`)}
      />
    </div>
  )
}
