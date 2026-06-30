'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { getDepartments } from '@/lib/api/departments'
import type { Department } from '@/lib/types'
import type {
  Task, TaskCategory, TaskPriority, TaskStatus, TaskDashboard, PeopleTree as PeopleTreeData,
  WorkScope, WorkBucket, WorkQuery, Timing, WorkFlow,
} from '@/lib/types/tasks'
import { TIMING_META } from '@/lib/types/tasks'
import { buildDeptForest, subtreeIds, pathTo } from '@/lib/tasks/dept-tree'
import CreateTaskModal from '@/components/tasks/CreateTaskModal'
import ScopeSwitcher from '@/components/tasks/overview/ScopeSwitcher'
import ViewToggle, { type View } from '@/components/tasks/overview/ViewToggle'
import LensToggle, { type Lens } from '@/components/tasks/overview/LensToggle'
import TaskTable, { type TableFilterKey } from '@/components/tasks/overview/TaskTable'
import DrillHero from '@/components/tasks/overview/DrillHero'
import KpiCards from '@/components/tasks/overview/KpiCards'
import DeptLeaderboard from '@/components/tasks/overview/DeptLeaderboard'
import DeptBreakdownChart, { type BreakdownDim } from '@/components/tasks/overview/DeptBreakdownChart'
import PeopleLeaderboard from '@/components/tasks/overview/PeopleLeaderboard'
import CrossDeptMatrix from '@/components/tasks/overview/CrossDeptMatrix'
import OwnView from '@/components/tasks/overview/OwnView'
import TeamView from '@/components/tasks/overview/TeamView'
import StatusTimingChart from '@/components/tasks/overview/StatusTimingChart'
import PrioritySpreadChart from '@/components/tasks/overview/PrioritySpreadChart'
import CategorySpreadChart from '@/components/tasks/overview/CategorySpreadChart'
import MonthlyTrendChart from '@/components/tasks/overview/MonthlyTrendChart'
import KeyInsights from '@/components/tasks/overview/KeyInsights'
import SegmentDrawer from '@/components/tasks/overview/SegmentDrawer'
import TaskRow from '@/components/tasks/overview/TaskRow'
import TaskDrawer from '@/components/tasks/overview/TaskDrawer'
import BulkActionBar from '@/components/tasks/overview/BulkActionBar'
import StyledSelect from '@/components/ui/StyledSelect'
import DateRangePicker from '@/components/ui/DateRangePicker'
import AccessHiddenState from '@/components/ui/AccessHiddenState'
import { usePermissions } from '@/lib/auth/use-permissions'
import { Plus, Search, SlidersHorizontal, X, BarChart3, Download, ListChecks, CheckSquare } from 'lucide-react'

const PAGE_SIZE = 25

const SCOPE_BLURB: Record<WorkScope, string> = {
  own: 'Work you gave or received.',
  team: 'Everything your reporting team is giving and receiving.',
  department: 'Your department’s work.',
  org: 'All work across the organization.',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function TasksOverviewPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const { can, loading: permsLoading } = usePermissions()

  // Masters + departments
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  // View (analytics canvas vs data table)
  const [view, setView] = useState<View>('analytics')

  // Scope / lens / drill
  const [requestedScope, setRequestedScope] = useState<WorkScope | undefined>(undefined)
  const [lens, setLens] = useState<Lens>('dept')
  const [deptDrill, setDeptDrill] = useState<string | null>(null)
  const [personDrill, setPersonDrill] = useState<string | null>(null)
  const [breakdownDim, setBreakdownDim] = useState<BreakdownDim>('dept')

  // Filters
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusId, setStatusId] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [timingFilter, setTimingFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState('created_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [showInsights, setShowInsights] = useState(true)
  const [bucket, setBucket] = useState<WorkBucket | null>(null)

  // Data
  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null)
  const [flow, setFlow] = useState<WorkFlow | null>(null)
  const [tree, setTree] = useState<PeopleTreeData | null>(null)
  const [rows, setRows] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Selection / drawers
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [segment, setSegment] = useState<{ title: string; subtitle: string; query: WorkQuery } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
      getDepartments(orgId).catch(() => [] as Department[]),
    ]).then(([c, p, s, d]) => { setCategories(c); setPriorities(p); setStatuses(s); setDepartments(d) })
  }, [orgId])

  const forest = useMemo(() => buildDeptForest(departments), [departments])

  // ── People forest (reporting structure, from the tree) ────────────────────────
  const peopleForest = useMemo(() => {
    const nodes = tree?.nodes ?? []
    const byId = new Map(nodes.map((n) => [n.user_id, n]))
    const childrenOf = new Map<string | null, string[]>()
    for (const n of nodes) {
      const parent = n.reporting_to_user_id && byId.has(n.reporting_to_user_id) && n.reporting_to_user_id !== n.user_id ? n.reporting_to_user_id : null
      if (!childrenOf.has(parent)) childrenOf.set(parent, [])
      childrenOf.get(parent)!.push(n.user_id)
    }
    const subtree = (id: string): string[] => [id, ...(childrenOf.get(id) ?? []).flatMap(subtree)]
    return { byId, subtree }
  }, [tree])

  // ── Base filters (the filter bar + scope) ─────────────────────────────────────
  const baseFilters: WorkQuery = useMemo(() => ({
    scope: requestedScope,
    search: search || undefined,
    status_id: statusId || undefined,
    priority_id: priorityId || undefined,
    category_id: categoryId || undefined,
    department_id: departmentId || undefined,
    type: typeFilter || undefined,
    timing: (timingFilter || undefined) as WorkQuery['timing'],
    from_date: fromDate || undefined,
    to_date: toDate ? `${toDate}T23:59:59` : undefined,
  }), [requestedScope, search, statusId, priorityId, categoryId, departmentId, typeFilter, timingFilter, fromDate, toDate])

  // The dept subtree currently drilled (Departments lens).
  const deptNode = deptDrill ? forest.byId.get(deptDrill) ?? null : null
  const deptSubtree = deptNode ? subtreeIds(deptNode).join(',') : undefined
  // The person subtree currently drilled (People lens).
  const personSubtree = personDrill ? peopleForest.subtree(personDrill).join(',') : undefined

  // Board query — drives KPIs, charts, insights, and the result list (drill-scoped).
  const boardQuery: WorkQuery = useMemo(() => ({
    ...baseFilters,
    ...(lens === 'dept' && deptSubtree ? { department_ids: deptSubtree } : {}),
    ...(lens === 'people' && personSubtree ? { assignee_user_ids: personSubtree } : {}),
  }), [baseFilters, lens, deptSubtree, personSubtree])

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const boardKey = JSON.stringify(boardQuery)
  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    tasksApi.getDashboard(orgId, JSON.parse(boardKey)).then((d) => { if (!cancelled) setDashboard(d) }).catch(() => { if (!cancelled) setDashboard(null) })
    return () => { cancelled = true }
  }, [orgId, boardKey])

  const appliedScope = dashboard?.applied_scope ?? requestedScope ?? 'own'
  const maxScope = dashboard?.max_scope ?? null
  const peopleAvailable = appliedScope === 'team' || appliedScope === 'org' || appliedScope === 'department'
  const isTeamScope = appliedScope === 'team' || appliedScope === 'department'

  // ── Work flow (source relationship / matrix / delegation) — analytics only, lazy ──
  const flowKey = JSON.stringify(baseFilters)
  useEffect(() => {
    if (!orgId || view !== 'analytics') return
    let cancelled = false
    tasksApi.getWorkFlow(orgId, JSON.parse(flowKey)).then((f) => { if (!cancelled) setFlow(f) }).catch(() => { if (!cancelled) setFlow(null) })
    return () => { cancelled = true }
  }, [orgId, flowKey, view])

  // ── People tree (unscoped by drill so the full forest is drillable). Needed by the
  //    People lens (Org) and by the Team layout's roster. ─────────────────────────
  const treeKey = JSON.stringify(baseFilters)
  const treeNeeded = (lens === 'people' && peopleAvailable) || (view === 'analytics' && isTeamScope)
  useEffect(() => {
    if (!orgId || !treeNeeded) { setTree(null); return }
    let cancelled = false
    tasksApi.getPeopleTree(orgId, JSON.parse(treeKey)).then((t) => { if (!cancelled) setTree(t) }).catch(() => { if (!cancelled) setTree(null) })
    return () => { cancelled = true }
  }, [orgId, treeKey, treeNeeded])

  // ── Result list ───────────────────────────────────────────────────────────────
  // The Analytics canvas scopes the list to the current drill + KPI bucket; the Table view
  // is a flat, fully-filterable list (base filters only, no drill/bucket scoping).
  const listQuery: WorkQuery = view === 'table' ? baseFilters : boardQuery
  const effectiveBucket = view === 'table' ? null : bucket
  const listQueryKey = JSON.stringify(listQuery)
  const listKey = JSON.stringify({ q: listQuery, bucket: effectiveBucket, sort })
  const fetchList = useCallback(async (pageNum: number, replace: boolean) => {
    if (!orgId) return
    replace ? setLoadingList(true) : setLoadingMore(true)
    try {
      const res = await tasksApi.listTasksPaged(orgId, { ...JSON.parse(listQueryKey), bucket: effectiveBucket ?? undefined, sort, page: pageNum, page_size: PAGE_SIZE })
      setRows((prev) => (replace ? res.items : [...prev, ...res.items]))
      setTotal(res.total); setHasMore(res.has_more); setPage(res.page)
    } finally {
      replace ? setLoadingList(false) : setLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, listKey])

  useEffect(() => { fetchList(1, true) }, [fetchList])

  const refreshAll = useCallback(() => {
    fetchList(1, true)
    tasksApi.getDashboard(orgId, JSON.parse(boardKey)).then(setDashboard).catch(() => {})
    if (lens === 'people' && peopleAvailable) tasksApi.getPeopleTree(orgId, JSON.parse(treeKey)).then(setTree).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchList, orgId, boardKey, treeKey, lens, peopleAvailable])

  // ── Lens / drill transitions ──────────────────────────────────────────────────
  function switchLens(l: Lens) { setLens(l); setBucket(null) }
  function drillDept(id: string) { setDeptDrill(id); setBreakdownDim('dept') }
  function drillPerson(id: string) { setPersonDrill(id) }

  const deptCrumbs = deptNode ? pathTo(forest.byId, deptNode.id).map((n) => ({ id: n.id, name: n.name })) : []
  const personCrumbs = useMemo(() => {
    if (!personDrill) return [] as { id: string; name: string }[]
    const chain: { id: string; name: string }[] = []
    let cur = peopleForest.byId.get(personDrill)
    while (cur) {
      chain.unshift({ id: cur.user_id, name: cur.name })
      const pid = cur.reporting_to_user_id
      cur = pid && pid !== cur.user_id ? peopleForest.byId.get(pid) : undefined
    }
    return chain
  }, [personDrill, peopleForest])

  const drilledPersonName = personDrill ? peopleForest.byId.get(personDrill)?.name : undefined

  // ── Segment drawer openers ──────────────────────────────────────────────────--
  const openSegment = (title: string, subtitle: string, extra: WorkQuery) =>
    setSegment({ title, subtitle, query: { ...boardQuery, ...extra } })

  const onStatusSegment = (id: string, label: string, timing: Timing) =>
    openSegment(label, 'Status × timing', { status_id: id, timing })
  const onPrioritySegment = (id: string, label: string) => openSegment(`${label} priority`, 'Current view', { priority_id: id })
  const onCategorySegment = (id: string, label: string) => openSegment(label, 'Category', { category_id: id })
  const onMonthSegment = (month: string, label: string) => {
    const d = new Date(month)
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    openSegment(`Due in ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, 'Month', {
      from_date: month, to_date: `${to.toISOString().slice(0, 10)}T23:59:59`,
    })
  }
  const onDeptBreakdownSegment = (kind: BreakdownDim, id: string, label: string) => {
    if (kind === 'role') openSegment(label, 'Job role', { role_id: id })
    else if (kind === 'person') openSegment(label, 'Assignee', { assignee_user_id: id })
    else {
      const node = forest.byId.get(id)
      openSegment(label, 'Sub-department', { department_ids: node ? subtreeIds(node).join(',') : id })
    }
  }
  // Cross-dept matrix cell drill: tasks given by `from` dept's people to `to` dept's people.
  const onMatrixCell = (fromId: string, fromName: string, toId: string, toName: string) =>
    openSegment(`${fromName} → ${toName}`, 'Cross-department tasks', { assigner_person_dept_id: fromId, assignee_person_dept_id: toId })

  // ── Filters / pills ─────────────────────────────────────────────────────────--
  const pills = useMemo(() => {
    const list: { label: string; clear: () => void }[] = []
    if (search) list.push({ label: `“${search}”`, clear: () => { setSearch(''); setSearchInput('') } })
    if (statusId) list.push({ label: `Status: ${statuses.find((s) => s.id === statusId)?.label ?? '—'}`, clear: () => setStatusId('') })
    if (priorityId) list.push({ label: `Priority: ${priorities.find((p) => p.id === priorityId)?.label ?? '—'}`, clear: () => setPriorityId('') })
    if (categoryId) list.push({ label: `Category: ${categories.find((c) => c.id === categoryId)?.name ?? '—'}`, clear: () => setCategoryId('') })
    if (departmentId) list.push({ label: `Dept: ${departments.find((d) => d.id === departmentId)?.name ?? '—'}`, clear: () => setDepartmentId('') })
    if (typeFilter) list.push({ label: `Type: ${typeFilter === 'recurring' ? 'Recurring' : 'One-time'}`, clear: () => setTypeFilter('') })
    if (timingFilter) list.push({ label: `Timing: ${TIMING_META[timingFilter as Timing].label}`, clear: () => setTimingFilter('') })
    if (fromDate || toDate) list.push({ label: `Date: ${fromDate || '…'} → ${toDate || '…'}`, clear: () => { setFromDate(''); setToDate('') } })
    return list
  }, [search, statusId, priorityId, categoryId, departmentId, typeFilter, timingFilter, fromDate, toDate, statuses, priorities, categories, departments])

  const filtersActive = pills.length > 0
  function clearFilters() {
    setSearchInput(''); setSearch(''); setStatusId(''); setPriorityId(''); setCategoryId('')
    setDepartmentId(''); setTypeFilter(''); setTimingFilter(''); setFromDate(''); setToDate('')
  }

  // Map the table's column-header filter selects onto the page filter state.
  const tableFilters: Record<TableFilterKey, string> = {
    type: typeFilter, department_id: departmentId, category_id: categoryId,
    priority_id: priorityId, status_id: statusId, timing: timingFilter,
  }
  const TABLE_SETTERS: Record<TableFilterKey, (v: string) => void> = {
    type: setTypeFilter, department_id: setDepartmentId, category_id: setCategoryId,
    priority_id: setPriorityId, status_id: setStatusId, timing: setTimingFilter,
  }
  const onTableFilter = (key: TableFilterKey, value: string) => TABLE_SETTERS[key](value)
  function toggleDeadlineSort() {
    setSort((s) => (s === 'deadline_asc' ? 'deadline_desc' : 'deadline_asc'))
  }
  const deadlineSortDir: 'asc' | 'desc' | null = sort === 'deadline_asc' ? 'asc' : sort === 'deadline_desc' ? 'desc' : null

  // Active-filter chips — multiple filters stack and each is individually removable.
  const pillsBar = pills.length > 0 ? (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[12px] text-[#94A3B8] font-medium">Active filters:</span>
      {pills.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-[999px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[12px] font-medium pl-2.5 pr-1.5 py-1">
          {p.label}
          <button onClick={p.clear} className="w-4 h-4 rounded-full hover:bg-[#2563EB] hover:text-white flex items-center justify-center transition-colors"><X size={11} /></button>
        </span>
      ))}
      <button onClick={clearFilters} className="text-[12px] text-[#DC2626] font-medium hover:underline">Clear all</button>
    </div>
  ) : null

  // ── Selection / bulk ──────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  async function runBulk(action: 'status' | 'deadline' | 'complete', payload: { status_id?: string; deadline?: string | null } = {}) {
    const ids = Array.from(selected)
    if (!ids.length) return
    setBulkBusy(true)
    try { await tasksApi.bulkUpdate(orgId, ids, action, payload); setSelected(new Set()); refreshAll() }
    finally { setBulkBusy(false) }
  }

  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const { csv } = await tasksApi.exportWork(orgId, { ...boardQuery, bucket: bucket ?? undefined })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `work-export-${appliedScope}.csv`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
        <p className="text-sm text-[#475569] mt-1">You are not a member of any organization.</p>
      </div>
    )
  }

  if (!permsLoading && !can('tasks.task.manage', 'read')) {
    return (
      <div className="space-y-5">
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Work Overview</h1>
        <AccessHiddenState orgId={orgId} leaf="tasks.task.manage" moduleLabel="Tasks" />
      </div>
    )
  }

  const drilled = (lens === 'dept' && deptNode) || (lens === 'people' && personDrill)

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Work Overview</h1>
          <p className="mt-1 text-[15px] text-[#475569]">{SCOPE_BLURB[appliedScope]}</p>
        </div>
        <div className="flex items-center gap-2">
          <ScopeSwitcher maxScope={maxScope} value={appliedScope} onChange={(s) => setRequestedScope(s)} />
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-[10px] bg-[#2563EB] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0">
            <Plus size={16} /> Create Task
          </button>
        </div>
      </div>

      {/* View tab: Analytics | Table */}
      <div className="border-b border-[#E2E8F0] pb-px">
        <ViewToggle value={view} onChange={setView} />
      </div>

      {view === 'analytics' ? (
      <>
      {/* Lens toggle + Insights toggle (Organization layout only) */}
      {appliedScope === 'org' && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <LensToggle value={lens} onChange={switchLens} />
          <button onClick={() => setShowInsights((v) => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] border text-sm font-medium transition-colors ${showInsights ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'}`}>
            <BarChart3 size={15} /> Insights
          </button>
        </div>
      )}

      {/* Drill hero (Org dept/people drill) */}
      {appliedScope === 'org' && lens === 'dept' && deptNode && dashboard && (
        <DrillHero
          title={deptNode.name}
          stats={`${dashboard.kpis.total} tasks · ${dashboard.kpis.completion_rate}% complete · ${dashboard.kpis.overdue} overdue`}
          crumbs={deptCrumbs}
          rootLabel="All units"
          onCrumb={(id) => drillDept(id)}
          onRoot={() => setDeptDrill(null)}
          onBack={() => setDeptDrill(deptCrumbs.length >= 2 ? deptCrumbs[deptCrumbs.length - 2].id : null)}
        />
      )}
      {appliedScope === 'org' && lens === 'people' && personDrill && dashboard && (
        <DrillHero
          title={drilledPersonName ?? 'Person'}
          stats={`${dashboard.kpis.total} tasks · ${dashboard.kpis.completion_rate}% complete · ${dashboard.kpis.overdue} overdue`}
          crumbs={personCrumbs}
          rootLabel="Everyone"
          onCrumb={(id) => drillPerson(id)}
          onRoot={() => setPersonDrill(null)}
          onBack={() => setPersonDrill(personCrumbs.length >= 2 ? personCrumbs[personCrumbs.length - 2].id : null)}
        />
      )}

      {/* ── Scope-tailored analytics ─────────────────────────────────────────── */}
      {dashboard && appliedScope === 'own' && (
        <OwnView dashboard={dashboard} flow={flow} userId={user?.id ?? ''} onSelectBucket={setBucket} onOpenSegment={openSegment} />
      )}
      {dashboard && isTeamScope && (
        <TeamView
          dashboard={dashboard}
          flow={flow}
          tree={tree}
          scopeLabel={appliedScope === 'department' ? 'my department' : 'my team'}
          onSelectBucket={setBucket}
          onOpenSegment={openSegment}
          onOpenReport={(uid) => router.push(`/dashboard/tasks/people/${uid}`)}
        />
      )}
      {dashboard && appliedScope === 'org' && (
        <>
          <KpiCards kpis={dashboard.kpis} onSelectBucket={setBucket} />
          {showInsights && (
            <div className="space-y-3">
              {/* Primary panel */}
              {lens === 'dept' ? (
                deptNode ? (
                  <DeptBreakdownChart
                    node={deptNode}
                    byDept={dashboard.by_department}
                    byRole={dashboard.by_role}
                    byAssignee={dashboard.by_assignee}
                    dim={breakdownDim}
                    onDim={setBreakdownDim}
                    onDrill={drillDept}
                    onSegment={onDeptBreakdownSegment}
                  />
                ) : (
                  <DeptLeaderboard byDept={dashboard.by_department} forest={forest} onDrill={drillDept} />
                )
              ) : tree ? (
                <PeopleLeaderboard nodes={tree.nodes} drillUserId={personDrill} onDrill={drillPerson} onOpenReport={(uid) => router.push(`/dashboard/tasks/people/${uid}`)} />
              ) : null}

              {/* Secondary charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <StatusTimingChart items={dashboard.by_status} onSegment={onStatusSegment} />
                <PrioritySpreadChart items={dashboard.by_priority} onSegment={onPrioritySegment} />
                <CategorySpreadChart items={dashboard.by_category} onSegment={onCategorySegment} />
              </div>

              {/* Cross-department flow matrix */}
              {flow && <CrossDeptMatrix matrix={flow.matrix} onCell={onMatrixCell} />}

              {/* Trend + insights */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2"><MonthlyTrendChart trend={dashboard.trend_monthly} onMonth={onMonthSegment} /></div>
                <KeyInsights dashboard={dashboard} contextLabel={drilled ? (lens === 'dept' ? deptNode?.name : drilledPersonName) : undefined} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search tasks…"
            className="w-full rounded-[8px] border border-[#CBD5E1] bg-white pl-9 pr-3 py-2.5 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]" />
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-[8px] border text-sm font-medium transition-colors ${showFilters || filtersActive ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'}`}>
          <SlidersHorizontal size={15} /> Filters{filtersActive && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[#2563EB]" />}
        </button>
        <button onClick={exportCsv} disabled={exporting}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[8px] border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-60 transition-colors">
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export'}
        </button>
        <StyledSelect
          value={sort}
          onChange={setSort}
          wrapperClassName="w-[170px]"
          options={[
            { value: 'created_desc', label: 'Newest first' },
            { value: 'created_asc', label: 'Oldest first' },
            { value: 'deadline_asc', label: 'Deadline ↑' },
            { value: 'deadline_desc', label: 'Deadline ↓' },
            { value: 'updated_desc', label: 'Recently updated' },
          ]}
        />
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StyledSelect
            value={statusId}
            onChange={setStatusId}
            placeholder="All statuses"
            options={[{ value: '', label: 'All statuses' }, ...statuses.map((s) => ({ value: s.id, label: s.label, color: s.color }))]}
          />
          <StyledSelect
            value={priorityId}
            onChange={setPriorityId}
            placeholder="All priorities"
            options={[{ value: '', label: 'All priorities' }, ...priorities.map((p) => ({ value: p.id, label: p.label, color: p.color }))]}
          />
          <StyledSelect
            value={categoryId}
            onChange={setCategoryId}
            placeholder="All categories"
            options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
          />
          <StyledSelect
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="All departments"
            options={[{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
          <StyledSelect
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as typeof typeFilter)}
            placeholder="All types"
            options={[
              { value: '', label: 'All types' },
              { value: 'one_time', label: 'One-time' },
              { value: 'recurring', label: 'Recurring' },
            ]}
          />
          <StyledSelect
            value={timingFilter}
            onChange={(v) => setTimingFilter(v as typeof timingFilter)}
            placeholder="All timing"
            options={[
              { value: '', label: 'All timing' },
              ...(['early', 'on_time', 'late', 'overdue', 'pending'] as Timing[]).map((t) => ({ value: t, label: TIMING_META[t].label })),
            ]}
          />
          <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} placeholder="Created date range" />
        </div>
      )}

      {/* Active pills */}
      {pillsBar}

      {/* Result count + bucket */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <button onClick={() => setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
              className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors">
              <ListChecks size={15} /> {selected.size === rows.length && rows.length > 0 ? 'Deselect' : 'Select'} page
            </button>
          )}
          <p className="text-sm text-[#475569]">
            {loadingList ? 'Loading…' : <><span className="font-semibold text-[#0F172A] tabular-nums">{total}</span> task{total !== 1 ? 's' : ''}{bucket ? ' in this bucket' : ''}</>}
          </p>
        </div>
        {bucket && <button onClick={() => setBucket(null)} className="text-sm text-[#2563EB] hover:underline flex items-center gap-1"><X size={13} /> Clear bucket</button>}
      </div>

      {/* Result surface */}
      {loadingList ? (
        <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4"><CheckSquare size={24} className="text-[#94A3B8]" /></div>
          <p className="font-semibold text-[#0F172A] text-base">{filtersActive || bucket || drilled ? 'No tasks match this view' : 'No tasks here yet'}</p>
          <p className="text-[#475569] text-sm mt-1 text-center max-w-xs">{filtersActive || bucket || drilled ? 'Try adjusting your filters or scope.' : 'Create a task to get started.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((t) => (
            <TaskRow key={t.id} task={t} onClick={() => setOpenTaskId(t.id)} selectable selected={selected.has(t.id)} onToggleSelect={() => toggleSelect(t.id)} />
          ))}
          {hasMore && (
            <button onClick={() => fetchList(page + 1, false)} disabled={loadingMore}
              className="mt-2 mx-auto px-5 py-2.5 rounded-[8px] border border-[#E2E8F0] bg-white text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-60 transition-colors">
              {loadingMore ? 'Loading…' : `Load more (${total - rows.length} left)`}
            </button>
          )}
        </div>
      )}
      </>
      ) : (
      <>
      {/* ── Table view ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search tasks…"
            className="w-full rounded-[8px] border border-[#CBD5E1] bg-white pl-9 pr-3 py-2.5 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]" />
        </div>
        <button onClick={exportCsv} disabled={exporting}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[8px] border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-60 transition-colors">
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      {pillsBar}

      <TaskTable
        rows={rows}
        loading={loadingList}
        total={total}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => fetchList(page + 1, false)}
        onOpenTask={(id) => setOpenTaskId(id)}
        departments={departments}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
        filters={tableFilters}
        onFilter={onTableFilter}
        sortDir={deadlineSortDir}
        onToggleDeadlineSort={toggleDeadlineSort}
      />
      </>
      )}

      <BulkActionBar
        count={selected.size}
        statuses={statuses}
        busy={bulkBusy}
        onStatus={(id) => runBulk('status', { status_id: id })}
        onComplete={() => runBulk('complete')}
        onDeadline={(d) => runBulk('deadline', { deadline: `${d}T23:59:59` })}
        onClear={() => setSelected(new Set())}
      />

      {segment && (
        <SegmentDrawer
          orgId={orgId}
          title={segment.title}
          subtitle={segment.subtitle}
          query={segment.query}
          onClose={() => setSegment(null)}
          onOpenTask={(id) => { setSegment(null); setOpenTaskId(id) }}
        />
      )}

      {openTaskId && (
        <TaskDrawer orgId={orgId} taskId={openTaskId} statuses={statuses} onClose={() => setOpenTaskId(null)} onChanged={refreshAll} />
      )}

      <CreateTaskModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refreshAll() }}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
      />
    </div>
  )
}
