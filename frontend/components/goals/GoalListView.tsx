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

  const [goals, setGoals] = useState<Goal[]>([])
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
    ])
      .then(([g, emps, depts]: any[]) => {
        setGoals(g)
        setEmployees(
          (emps as any[]).map((e) => ({ user_id: e.user_id, name: e.user?.name ?? e.name ?? e.email ?? 'Unknown' })),
        )
        setDepartments((depts as any[]).map((d) => ({ id: d.id, name: d.name })))
      })
      .finally(() => setLoading(false))
  }, [orgId, level])

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">{meta.plural}</h1>
          <p className="text-sm text-[#475569] mt-1">
            {level === 'objective' && '3–5 year strategic north stars.'}
            {level === 'annual' && 'Yearly goals, each tagged with a Balanced-Scorecard perspective and linked to an objective.'}
            {level === 'quarterly' && 'Quarterly goals that roll up to an annual goal and carry work via linked tasks.'}
          </p>
        </div>
        {level === 'objective' && perms.write && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] shrink-0"
          >
            <Plus size={16} /> New Objective
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
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Target size={26} />}
            title={isFiltered ? 'No goals match your filters' : `No ${meta.plural.toLowerCase()} yet`}
            subtitle={
              isFiltered
                ? 'Try clearing a filter.'
                : level === 'objective'
                  ? 'Start by creating an objective — your top-level strategic goal.'
                  : level === 'annual'
                    ? 'Open an objective and add an annual goal under it.'
                    : 'Open an annual goal and add a quarterly goal under it.'
            }
            action={
              level === 'objective' && perms.write && !isFiltered ? (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px]"
                >
                  <Plus size={16} /> New Objective
                </button>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Goal</th>
                {showPerspective && (
                  <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Perspective
                  </th>
                )}
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Owner</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Due</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 w-44 hidden md:table-cell">Progress</th>
                <th className="px-2 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/goals/${g.id}`)}
                  className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0F172A] text-[15px]">{g.title}</div>
                    {g._count?.children ? (
                      <div className="text-xs text-[#64748B] mt-0.5">{g._count.children} child goal(s)</div>
                    ) : null}
                  </td>
                  {showPerspective && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <PerspectiveBadge perspective={g.perspective} />
                    </td>
                  )}
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-[#1E293B]">{g.owner?.name ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-[#475569]">{formatDate(g.due_date)}</td>
                  <td className="px-4 py-3">
                    <GoalStatusBadge status={g.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ProgressBar value={g.progress_percent} />
                  </td>
                  <td className="px-2 py-3 text-[#CBD5E1]">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {level === 'objective' && (
        <CreateGoalModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          orgId={orgId}
          level="objective"
          employees={employees}
          departments={departments}
          onCreated={() => load()}
        />
      )}
    </div>
  )
}
