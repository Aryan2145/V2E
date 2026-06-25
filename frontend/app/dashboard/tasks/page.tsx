'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { getNow } from '@/lib/clock'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import KanbanView from '@/components/tasks/KanbanView'
import CalendarView from '@/components/tasks/CalendarView'
import CreateTaskModal from '@/components/tasks/CreateTaskModal'
import TaskFilterBar, { type TaskFilters, EMPTY_TASK_FILTERS, isTaskFiltered, applyTaskFilters } from '@/components/tasks/TaskFilterBar'
import {
  Plus, CheckSquare, AlertTriangle, Calendar, CheckCircle2,
  TrendingUp, LayoutList, Columns, CalendarDays,
} from 'lucide-react'

type ViewMode = 'list' | 'kanban' | 'calendar'
type QuickFilter = 'today' | 'overdue' | 'week' | 'completed_month' | null

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, active, onClick }: {
  label: string; value: number; icon: React.ReactNode; color: string
  active?: boolean; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'bg-white border rounded-[12px] p-4 sm:p-6 flex items-start gap-3 sm:gap-4 w-full text-left transition-all duration-150',
        active
          ? 'shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
          : 'border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)] hover:border-[#CBD5E1]',
      ].join(' ')}
      style={active ? { borderColor: color, boxShadow: `0 0 0 2px ${color}30, 0 2px 8px rgba(0,0,0,0.08)` } : undefined}
    >
      <div
        className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + '18', color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#0F172A] leading-tight tabular-nums">{value}</p>
        <p className="text-sm mt-0.5" style={{ color: active ? color : '#475569' }}>{label}</p>
      </div>
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <CheckSquare size={24} className="text-[#94A3B8]" />
      </div>
      <p className="font-semibold text-[#0F172A] text-base">
        {filtered ? 'No tasks match your filters' : 'No tasks yet'}
      </p>
      <p className="text-[#475569] text-sm mt-1 text-center max-w-xs">
        {filtered ? 'Try adjusting your filters.' : 'Create your first task to get started.'}
      </p>
    </div>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isToday(d: string) {
  const v = new Date(d), n = getNow()
  return v.getFullYear() === n.getFullYear() && v.getMonth() === n.getMonth() && v.getDate() === n.getDate()
}
function isPast(d: string) { return new Date(d) < getNow() }
function isThisWeek(d: string) {
  const v = new Date(d), n = getNow()
  const start = new Date(n); start.setDate(n.getDate() - n.getDay()); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(start.getDate() + 7)
  return v >= start && v < end
}
function isThisMonth(d: string) {
  const v = new Date(d), n = getNow()
  return v.getMonth() === n.getMonth() && v.getFullYear() === n.getFullYear()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = user?.organizationId ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null)
  const rawView = searchParams.get('view')
  const viewMode: ViewMode = rawView === 'kanban' || rawView === 'calendar' ? rawView : 'list'
  function setViewMode(mode: ViewMode) {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'list') params.delete('view')
    else params.set('view', mode)
    router.replace(`/dashboard/tasks?${params.toString()}`)
  }

  // Filters
  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_TASK_FILTERS })

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.listTasks(orgId).catch(() => []),
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
    ]).then(([t, c, p, s]) => {
      setTasks(t); setCategories(c); setPriorities(p); setStatuses(s)
    }).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  const myUserId = user?.id ?? ''
  const myTasksToday = useMemo(() =>
    tasks.filter((t) => t.assignees?.some((a) => a.user_id === myUserId && !a.is_cc) && t.deadline && isToday(t.deadline)).length,
    [tasks, myUserId])
  const overdue = useMemo(() =>
    tasks.filter((t) => t.deadline && isPast(t.deadline) && t.status?.type !== 'completed' && t.status?.type !== 'incomplete').length,
    [tasks])
  const dueThisWeek = useMemo(() =>
    tasks.filter((t) => t.deadline && isThisWeek(t.deadline)).length, [tasks])
  const completedThisMonth = useMemo(() =>
    tasks.filter((t) => t.status?.type === 'completed' && isThisMonth(t.updated_at)).length, [tasks])

  // Quick-filter (stat cards) applies first; the dropdown filters and their
  // option counts then work within that subset.
  const quickFiltered = useMemo(() => {
    if (!quickFilter) return tasks
    if (quickFilter === 'today') return tasks.filter((t) => t.assignees?.some((a) => a.user_id === myUserId && !a.is_cc) && t.deadline && isToday(t.deadline))
    if (quickFilter === 'overdue') return tasks.filter((t) => t.deadline && isPast(t.deadline) && t.status?.type !== 'completed' && t.status?.type !== 'incomplete')
    if (quickFilter === 'week') return tasks.filter((t) => t.deadline && isThisWeek(t.deadline))
    if (quickFilter === 'completed_month') return tasks.filter((t) => t.status?.type === 'completed' && isThisMonth(t.updated_at))
    return tasks
  }, [tasks, quickFilter, myUserId])

  const filtered = useMemo(() => applyTaskFilters(quickFiltered, filters), [quickFiltered, filters])
  const isFiltered = isTaskFiltered(filters)

  function handleQuickFilter(f: Exclude<QuickFilter, null>) {
    setQuickFilter((prev) => (prev === f ? null : f))
  }

  async function handleStatusChange(taskId: string, newStatusId: string) {
    await tasksApi.updateTask(orgId, taskId, { status_id: newStatusId })
    loadData()
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
        <p className="text-sm text-[#475569] mt-1">You are not a member of any organization.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Tasks</h1>
          <p className="mt-1 text-[15px] text-[#475569]">Manage and track all tasks across your organization.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-[10px] bg-[#2563EB] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0"
        >
          <Plus size={16} />
          Create Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="My Tasks Today" value={myTasksToday} icon={<CheckSquare size={20} />} color="#2563EB" active={quickFilter === 'today'} onClick={() => handleQuickFilter('today')} />
        <StatCard label="Overdue" value={overdue} icon={<AlertTriangle size={20} />} color="#DC2626" active={quickFilter === 'overdue'} onClick={() => handleQuickFilter('overdue')} />
        <StatCard label="Due This Week" value={dueThisWeek} icon={<Calendar size={20} />} color="#D97706" active={quickFilter === 'week'} onClick={() => handleQuickFilter('week')} />
        <StatCard label="Completed This Month" value={completedThisMonth} icon={<CheckCircle2 size={20} />} color="#16A34A" active={quickFilter === 'completed_month'} onClick={() => handleQuickFilter('completed_month')} />
        <StatCard label="Total Tasks" value={tasks.length} icon={<TrendingUp size={20} />} color="#0891B2" active={quickFilter === null} onClick={() => setQuickFilter(null)} />
      </div>

      {/* Toolbar: filters + view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
        {/* Filters (hidden in calendar view) */}
        {viewMode !== 'calendar' && (
          <TaskFilterBar
            tasks={quickFiltered}
            statuses={statuses}
            priorities={priorities}
            categories={categories}
            filters={filters}
            onChange={setFilters}
          />
        )}

        {/* View toggle */}
        <div className="flex items-center border border-[#E2E8F0] rounded-[8px] bg-white p-0.5 gap-0.5 shrink-0 ml-auto sm:ml-0">
          {([
            { mode: 'list', icon: <LayoutList size={15} />, label: 'List' },
            { mode: 'kanban', icon: <Columns size={15} />, label: 'Kanban' },
            { mode: 'calendar', icon: <CalendarDays size={15} />, label: 'Calendar' },
          ] as const).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' && (
        <>
          <p className="text-sm text-[#475569]">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
            {(isFiltered || quickFilter) && ` (filtered from ${tasks.length})`}
          </p>
          {filtered.length === 0 ? (
            <EmptyState filtered={isFiltered || !!quickFilter} />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  priorities={priorities}
                  statuses={statuses}
                  categories={categories}
                />
              ))}
            </div>
          )}
        </>
      )}

      {viewMode === 'kanban' && (
        <KanbanView
          tasks={filtered}
          statuses={statuses}
          priorities={priorities}
          categories={categories}
          onStatusChange={handleStatusChange}
          onTaskClick={(id) => router.push(`/dashboard/tasks/${id}`)}
        />
      )}

      {viewMode === 'calendar' && (
        <CalendarView
          tasks={quickFiltered}
          priorities={priorities}
          onTaskClick={(id) => router.push(`/dashboard/tasks/${id}`)}
        />
      )}

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => { setShowCreateModal(false); loadData() }}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
      />
    </div>
  )
}
