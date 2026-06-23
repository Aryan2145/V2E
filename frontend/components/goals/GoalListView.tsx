'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Target, Plus, Search, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { goalsApi } from '@/lib/api/goals'
import { getEmployees } from '@/lib/api/employees'
import { getDepartments } from '@/lib/api/departments'
import {
  LEVEL_META,
  PERSPECTIVE_META,
  STATUS_META,
  type Goal,
  type GoalLevel,
  type GoalPerspective,
  type GoalStatus,
} from '@/lib/types/goals'
import {
  EmptyState,
  GoalStatusBadge,
  PerspectiveBadge,
  ProgressBar,
  formatDate,
  useGoalPermissions,
} from './shared'
import CreateGoalModal from './CreateGoalModal'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

const PERSPECTIVES: GoalPerspective[] = ['financial', 'customer', 'internal_process', 'learning_growth']
const STATUSES: GoalStatus[] = ['not_started', 'on_track', 'at_risk', 'achieved', 'archived']

const selectClass =
  'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'

export default function GoalListView({ level }: { level: GoalLevel }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = user?.organizationId ?? ''
  const meta = LEVEL_META[level]
  const showPerspective = level !== 'objective'
  const { perms } = useGoalPermissions(orgId)

  // The parent level a new goal at this level rolls up to: annual → objective, quarterly → annual.
  const parentLevel: GoalLevel | null = level === 'annual' ? 'objective' : level === 'quarterly' ? 'annual' : null

  const [goals, setGoals] = useState<Goal[]>([])
  const [parentOptions, setParentOptions] = useState<Goal[]>([])
  const [employees, setEmployees] = useState<{ user_id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [perspective, setPerspective] = useState<GoalPerspective | ''>(
    (searchParams.get('perspective') as GoalPerspective) || '',
  )
  const [owner, setOwner] = useState('')
  const [status, setStatus] = useState<GoalStatus | ''>('')

  const load = useCallback(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      goalsApi.list(orgId, { level }).catch(() => []),
      getEmployees(orgId).catch(() => []),
      getDepartments(orgId).catch(() => []),
      parentLevel ? goalsApi.list(orgId, { level: parentLevel }).catch(() => []) : Promise.resolve([]),
    ])
      .then(([g, emps, depts, parents]: any[]) => {
        setGoals(g)
        setEmployees(
          (emps as any[]).map((e) => ({ user_id: e.user_id, name: e.user?.name ?? e.name ?? e.email ?? 'Unknown' })),
        )
        setDepartments((depts as any[]).map((d) => ({ id: d.id, name: d.name })))
        setParentOptions(parents as Goal[])
      })
      .finally(() => setLoading(false))
  }, [orgId, level, parentLevel])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return goals.filter((g) => {
      if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false
      if (perspective && g.perspective !== perspective) return false
      if (owner && g.owner_user_id !== owner) return false
      if (status && g.status !== status) return false
      return true
    })
  }, [goals, search, perspective, owner, status])

  const isFiltered = !!(search || perspective || owner || status)

  const columns = useMemo<ResponsiveColumn<Goal>[]>(() => {
    const cols: ResponsiveColumn<Goal>[] = [
      {
        key: 'goal',
        header: meta.label,
        primary: true,
        render: (g) => (
          <>
            <div className="font-medium text-[#0F172A] text-[15px]">{g.title}</div>
            {g._count?.children ? (
              <div className="text-xs text-[#64748B] mt-0.5">{g._count.children} child goal(s)</div>
            ) : null}
          </>
        ),
      },
    ]
    if (showPerspective) {
      cols.push({
        key: 'perspective',
        header: 'Perspective',
        desktopHiddenBelow: 'md',
        render: (g) => <PerspectiveBadge perspective={g.perspective} />,
      })
    }
    cols.push(
      {
        key: 'owner',
        header: 'Owner',
        cellClassName: 'text-sm text-[#1E293B]',
        render: (g) => g.owner?.name ?? '—',
      },
      {
        key: 'due',
        header: 'Due',
        desktopHiddenBelow: 'lg',
        cellClassName: 'text-sm text-[#475569]',
        render: (g) => formatDate(g.due_date),
      },
      {
        key: 'status',
        header: 'Status',
        render: (g) => <GoalStatusBadge status={g.status} />,
      },
      {
        key: 'progress',
        header: 'Progress',
        desktopHiddenBelow: 'md',
        headerClassName: 'w-44',
        render: (g) => <ProgressBar value={g.progress_percent} />,
      },
      {
        key: 'chevron',
        header: '',
        hideOnMobile: true,
        cellClassName: 'text-[#CBD5E1] w-8',
        headerClassName: 'w-8',
        render: () => <ChevronRight size={16} />,
      },
    )
    return cols
  }, [showPerspective, meta.label])

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">{meta.plural}</h1>
          <p className="text-sm text-[#475569] mt-1">
            {level === 'objective' && '3–5 year strategic north stars.'}
            {level === 'annual' && 'Goals, each tagged with a Balanced-Scorecard perspective and linked to an objective.'}
            {level === 'quarterly' && 'Sub-goals that roll up to a goal and carry work via linked tasks.'}
          </p>
        </div>
        {perms.write && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] shrink-0"
          >
            <Plus size={16} /> New {meta.label}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            className={`${selectClass} w-full pl-9`}
            placeholder={`Search ${meta.plural.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {showPerspective && (
          <select className={selectClass} value={perspective} onChange={(e) => setPerspective(e.target.value as any)}>
            <option value="">All perspectives</option>
            {PERSPECTIVES.map((p) => (
              <option key={p} value={p}>
                {PERSPECTIVE_META[p].label}
              </option>
            ))}
          </select>
        )}
        <select className={selectClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {employees.map((e) => (
            <option key={e.user_id} value={e.user_id}>
              {e.name}
            </option>
          ))}
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <ResponsiveTable
        columns={columns}
        rows={filtered}
        rowKey={(g) => g.id}
        loading={loading}
        onRowClick={(g) => router.push(`/goals/${g.id}`)}
        emptyState={
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
            <EmptyState
              icon={<Target size={26} />}
              title={isFiltered ? 'No goals match your filters' : `No ${meta.plural.toLowerCase()} yet`}
              subtitle={
                isFiltered
                  ? 'Try clearing a filter.'
                  : level === 'objective'
                    ? 'Start by creating an objective — your top-level strategic goal.'
                    : level === 'annual'
                      ? 'Open an objective and add a goal under it.'
                      : 'Open a goal and add a sub-goal under it.'
              }
              action={
                perms.write && !isFiltered ? (
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px]"
                  >
                    <Plus size={16} /> New {meta.label}
                  </button>
                ) : undefined
              }
            />
          </div>
        }
      />

      <CreateGoalModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId}
        level={level}
        parentOptions={parentLevel ? parentOptions : undefined}
        employees={employees}
        departments={departments}
        onCreated={() => load()}
      />
    </div>
  )
}
