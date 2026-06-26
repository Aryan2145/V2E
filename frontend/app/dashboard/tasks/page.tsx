'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type {
  Task, TaskCategory, TaskPriority, TaskStatus, TaskDashboard, PeopleTree as PeopleTreeData,
  WorkScope, WorkBucket, WorkQuery,
} from '@/lib/types/tasks'
import CreateTaskModal from '@/components/tasks/CreateTaskModal'
import ScopeSwitcher from '@/components/tasks/overview/ScopeSwitcher'
import KpiTiles from '@/components/tasks/overview/KpiTiles'
import TaskRow from '@/components/tasks/overview/TaskRow'
import TaskDrawer from '@/components/tasks/overview/TaskDrawer'
import BreakdownPanel, { type BreakdownSelection } from '@/components/tasks/overview/BreakdownPanel'
import TrendChart from '@/components/tasks/overview/TrendChart'
import PeopleTree from '@/components/tasks/overview/PeopleTree'
import BulkActionBar from '@/components/tasks/overview/BulkActionBar'
import SelectField from '@/components/ui/SelectField'
import DateRangePicker from '@/components/ui/DateRangePicker'
import AccessHiddenState from '@/components/ui/AccessHiddenState'
import { usePermissions } from '@/lib/auth/use-permissions'
import {
  Plus, Search, CheckSquare, SlidersHorizontal, X, BarChart3, Download, ListChecks,
} from 'lucide-react'

const PAGE_SIZE = 25

const SCOPE_BLURB: Record<WorkScope, string> = {
  own: 'Work you gave or received.',
  team: 'Everything your reporting team is giving and receiving.',
  department: 'Your department’s work.',
  org: 'All work across the organization.',
}

export default function TasksOverviewPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { can, loading: permsLoading } = usePermissions()

  // Masters
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])

  // Scope + filters
  const [requestedScope, setRequestedScope] = useState<WorkScope | undefined>(undefined)
  const [bucket, setBucket] = useState<WorkBucket | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusId, setStatusId] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [createdById, setCreatedById] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState('created_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [showInsights, setShowInsights] = useState(true)

  // Data
  const [dashboard, setDashboard] = useState<TaskDashboard | null>(null)
  const [tree, setTree] = useState<PeopleTreeData | null>(null)
  const [rows, setRows] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Selection / bulk
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // UI
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [exporting, setExporting] = useState(false)

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
    ]).then(([c, p, s]) => { setCategories(c); setPriorities(p); setStatuses(s) })
  }, [orgId])

  const filters: WorkQuery = useMemo(() => ({
    scope: requestedScope,
    search: search || undefined,
    status_id: statusId || undefined,
    priority_id: priorityId || undefined,
    category_id: categoryId || undefined,
    department_id: departmentId || undefined,
    type: typeFilter || undefined,
    assignee_user_id: assigneeUserId || undefined,
    created_by_user_id: createdById || undefined,
    from_date: fromDate || undefined,
    to_date: toDate ? `${toDate}T23:59:59` : undefined,
  }), [requestedScope, search, statusId, priorityId, categoryId, departmentId, typeFilter, assigneeUserId, createdById, fromDate, toDate])

  // Dashboard (no bucket — the tiles show every bucket).
  const dashKey = JSON.stringify(filters)
  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    tasksApi.getDashboard(orgId, JSON.parse(dashKey)).then((d) => { if (!cancelled) setDashboard(d) }).catch(() => { if (!cancelled) setDashboard(null) })
    return () => { cancelled = true }
  }, [orgId, dashKey])

  const appliedScope = dashboard?.applied_scope ?? requestedScope ?? 'own'
  const maxScope = dashboard?.max_scope ?? null
  const showTree = showInsights && (appliedScope === 'team' || appliedScope === 'org' || appliedScope === 'department')

  // People tree (team/org scope only).
  useEffect(() => {
    if (!orgId || !showTree) { setTree(null); return }
    let cancelled = false
    tasksApi.getPeopleTree(orgId, JSON.parse(dashKey)).then((t) => { if (!cancelled) setTree(t) }).catch(() => { if (!cancelled) setTree(null) })
    return () => { cancelled = true }
  }, [orgId, dashKey, showTree])

  // Result list.
  const listKey = JSON.stringify({ ...filters, bucket, sort })
  const fetchList = useCallback(async (pageNum: number, replace: boolean) => {
    if (!orgId) return
    replace ? setLoadingList(true) : setLoadingMore(true)
    try {
      const res = await tasksApi.listTasksPaged(orgId, { ...filters, bucket: bucket ?? undefined, sort, page: pageNum, page_size: PAGE_SIZE })
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
    tasksApi.getDashboard(orgId, JSON.parse(dashKey)).then(setDashboard).catch(() => {})
    if (showTree) tasksApi.getPeopleTree(orgId, JSON.parse(dashKey)).then(setTree).catch(() => {})
  }, [fetchList, orgId, dashKey, showTree])

  // ── Breakdown slicer wiring ───────────────────────────────────────────────────
  const selection: BreakdownSelection = {
    status_id: statusId || undefined,
    priority_id: priorityId || undefined,
    category_id: categoryId || undefined,
    department_id: departmentId || undefined,
    type: typeFilter || undefined,
    assignee_user_id: assigneeUserId || undefined,
    created_by_user_id: createdById || undefined,
  }
  const SETTERS: Record<keyof BreakdownSelection, (v: string) => void> = {
    status_id: setStatusId, priority_id: setPriorityId, category_id: setCategoryId,
    department_id: setDepartmentId, type: setTypeFilter, assignee_user_id: setAssigneeUserId, created_by_user_id: setCreatedById,
  }
  const onBreakdownChange = (key: keyof BreakdownSelection, value: string | null) => SETTERS[key](value ?? '')

  // ── Active filter pills ───────────────────────────────────────────────────────
  const pills = useMemo(() => {
    const list: { label: string; clear: () => void }[] = []
    if (search) list.push({ label: `“${search}”`, clear: () => { setSearch(''); setSearchInput('') } })
    if (statusId) list.push({ label: `Status: ${statuses.find((s) => s.id === statusId)?.label ?? '—'}`, clear: () => setStatusId('') })
    if (priorityId) list.push({ label: `Priority: ${priorities.find((p) => p.id === priorityId)?.label ?? '—'}`, clear: () => setPriorityId('') })
    if (categoryId) list.push({ label: `Category: ${categories.find((c) => c.id === categoryId)?.name ?? '—'}`, clear: () => setCategoryId('') })
    if (departmentId) list.push({ label: `Dept: ${dashboard?.by_department.find((d) => d.id === departmentId)?.label ?? '—'}`, clear: () => setDepartmentId('') })
    if (typeFilter) list.push({ label: `Type: ${typeFilter}`, clear: () => setTypeFilter('') })
    if (assigneeUserId) list.push({ label: `Assigned to: ${dashboard?.by_assignee.find((a) => a.id === assigneeUserId)?.label ?? '—'}`, clear: () => setAssigneeUserId('') })
    if (createdById) list.push({ label: `Assigned by: ${dashboard?.by_assigner.find((a) => a.id === createdById)?.label ?? '—'}`, clear: () => setCreatedById('') })
    if (fromDate || toDate) list.push({ label: `Date: ${fromDate || '…'} → ${toDate || '…'}`, clear: () => { setFromDate(''); setToDate('') } })
    return list
  }, [search, statusId, priorityId, categoryId, departmentId, typeFilter, assigneeUserId, createdById, fromDate, toDate, statuses, priorities, categories, dashboard])

  const filtersActive = pills.length > 0
  function clearFilters() {
    setSearchInput(''); setSearch(''); setStatusId(''); setPriorityId(''); setCategoryId('')
    setDepartmentId(''); setTypeFilter(''); setAssigneeUserId(''); setCreatedById(''); setFromDate(''); setToDate('')
  }

  // ── Selection / bulk ──────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  async function runBulk(action: 'status' | 'deadline' | 'complete', payload: { status_id?: string; deadline?: string | null } = {}) {
    const ids = Array.from(selected)
    if (!ids.length) return
    setBulkBusy(true)
    try {
      await tasksApi.bulkUpdate(orgId, ids, action, payload)
      setSelected(new Set())
      refreshAll()
    } finally { setBulkBusy(false) }
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const { csv } = await tasksApi.exportWork(orgId, { ...filters, bucket: bucket ?? undefined })
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

      {/* KPI tiles */}
      {dashboard && <KpiTiles kpis={dashboard.kpis} active={bucket} onSelect={setBucket} />}

      {/* Insights (breakdowns + trend + tree) */}
      {dashboard && showInsights && (
        <div className="space-y-3">
          <BreakdownPanel data={dashboard} selection={selection} onChange={onBreakdownChange} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            <TrendChart trend={dashboard.trend} />
            {showTree && tree && <PeopleTree data={tree} />}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search tasks…"
            className="w-full rounded-[8px] border border-[#CBD5E1] bg-white pl-9 pr-3 py-2.5 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]" />
        </div>
        <button onClick={() => setShowInsights((v) => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-[8px] border text-sm font-medium transition-colors ${showInsights ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'}`}>
          <BarChart3 size={15} /> Insights
        </button>
        <button onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-[8px] border text-sm font-medium transition-colors ${showFilters || filtersActive ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'}`}>
          <SlidersHorizontal size={15} /> Filters{filtersActive && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[#2563EB]" />}
        </button>
        <button onClick={exportCsv} disabled={exporting}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[8px] border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-60 transition-colors">
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export'}
        </button>
        <SelectField value={sort} onChange={(e) => setSort(e.target.value)} wrapperClassName="w-[170px]">
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="deadline_asc">Deadline ↑</option>
          <option value="deadline_desc">Deadline ↓</option>
          <option value="updated_desc">Recently updated</option>
        </SelectField>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SelectField value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </SelectField>
          <SelectField value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
            <option value="">All priorities</option>
            {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </SelectField>
          <SelectField value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="one_time">One-time</option>
            <option value="recurring">Recurring</option>
          </SelectField>
          <DateRangePicker from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} placeholder="Created date range" />
        </div>
      )}

      {/* Active filter pills */}
      {pills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {pills.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-[999px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] text-[12px] font-medium pl-2.5 pr-1.5 py-1">
              {p.label}
              <button onClick={p.clear} className="w-4 h-4 rounded-full hover:bg-[#2563EB] hover:text-white flex items-center justify-center transition-colors"><X size={11} /></button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-[12px] text-[#DC2626] font-medium hover:underline">Clear all</button>
        </div>
      )}

      {/* Result count + select-all + bucket */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {rows.length > 0 && (
            <button onClick={() => setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
              className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors">
              <ListChecks size={15} /> {selected.size === rows.length && rows.length > 0 ? 'Deselect' : 'Select'} page
            </button>
          )}
          <p className="text-sm text-[#475569]">
            {loadingList ? 'Loading…' : <><span className="font-semibold text-[#0F172A] tabular-nums">{total}</span> task{total !== 1 ? 's' : ''}{bucket ? ' in this view' : ''}</>}
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
          <p className="font-semibold text-[#0F172A] text-base">{filtersActive || bucket ? 'No tasks match this view' : 'No tasks here yet'}</p>
          <p className="text-[#475569] text-sm mt-1 text-center max-w-xs">{filtersActive || bucket ? 'Try adjusting your filters or scope.' : 'Create a task to get started.'}</p>
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

      <BulkActionBar
        count={selected.size}
        statuses={statuses}
        busy={bulkBusy}
        onStatus={(id) => runBulk('status', { status_id: id })}
        onComplete={() => runBulk('complete')}
        onDeadline={(d) => runBulk('deadline', { deadline: `${d}T23:59:59` })}
        onClear={() => setSelected(new Set())}
      />

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
