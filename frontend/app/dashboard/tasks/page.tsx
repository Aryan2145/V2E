'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import KanbanView from '@/components/tasks/KanbanView'
import CalendarView from '@/components/tasks/CalendarView'
import CreateTaskModal from '@/components/tasks/CreateTaskModal'
import {
  Plus, CheckSquare, AlertTriangle, Calendar, CheckCircle2,
  TrendingUp, Filter, LayoutList, Columns, CalendarDays,
} from 'lucide-react'

type ViewMode = 'list' | 'kanban' | 'calendar'

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + '18', color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#0F172A] leading-tight tabular-nums">{value}</p>
        <p className="text-sm text-[#475569] mt-0.5">{label}</p>
      </div>
    </div>
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
  const v = new Date(d), n = new Date()
  return v.getFullYear() === n.getFullYear() && v.getMonth() === n.getMonth() && v.getDate() === n.getDate()
}
function isPast(d: string) { return new Date(d) < new Date() }
function isThisWeek(d: string) {
  const v = new Date(d), n = new Date()
  const start = new Date(n); start.setDate(n.getDate() - n.getDay()); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(start.getDate() + 7)
  return v >= start && v < end
}
function isThisMonth(d: string) {
  const v = new Date(d), n = new Date()
  return v.getMonth() === n.getMonth() && v.getFullYear() === n.getFullYear()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  // const [filterQuadrant, setFilterQuadrant] = useState<'all' | TaskQuadrant>('all')

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
    tasks.filter((t) => t.deadline && isPast(t.deadline) && t.status?.type !== 'completed').length,
    [tasks])
  const dueThisWeek = useMemo(() =>
    tasks.filter((t) => t.deadline && isThisWeek(t.deadline)).length, [tasks])
  const completedThisMonth = useMemo(() =>
    tasks.filter((t) => t.status?.type === 'completed' && isThisMonth(t.updated_at)).length, [tasks])

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status_id !== filterStatus) return false
    if (filterPriority !== 'all' && t.priority_id !== filterPriority) return false
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false
    // if (filterQuadrant !== 'all' && t.quadrant !== filterQuadrant) return false
    return true
  }), [tasks, filterStatus, filterPriority, filterCategory])

  const isFiltered = filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all'

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
        <StatCard label="My Tasks Today" value={myTasksToday} icon={<CheckSquare size={20} />} color="#2563EB" />
        <StatCard label="Overdue" value={overdue} icon={<AlertTriangle size={20} />} color="#DC2626" />
        <StatCard label="Due This Week" value={dueThisWeek} icon={<Calendar size={20} />} color="#D97706" />
        <StatCard label="Completed This Month" value={completedThisMonth} icon={<CheckCircle2 size={20} />} color="#16A34A" />
        <StatCard label="Total Tasks" value={tasks.length} icon={<TrendingUp size={20} />} color="#0891B2" />
      </div>

      {/* Toolbar: filters + view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
        {/* Filters (hidden in calendar view) */}
        {viewMode !== 'calendar' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-[#475569]">
              <Filter size={15} />
              <span className="font-medium">Filter</span>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-[7px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
            >
              <option value="all">All Statuses</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-[7px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
            >
              <option value="all">All Priorities</option>
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-[7px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {/* Quadrant filter — hidden */}
            {/* <select
              value={filterQuadrant}
              onChange={(e) => setFilterQuadrant(e.target.value as 'all' | TaskQuadrant)}
              className="px-3 py-[7px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
            >
              <option value="all">All Quadrants</option>
              <option value="Q1">Q1 — Urgent + Important</option>
              <option value="Q2">Q2 — Not Urgent + Important</option>
              <option value="Q3">Q3 — Urgent + Not Important</option>
              <option value="Q4">Q4 — Not Urgent + Not Important</option>
            </select> */}
            {isFiltered && (
              <button
                onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterCategory('all') }}
                className="px-3 py-[7px] text-sm font-medium text-[#DC2626] border border-[#FECACA] bg-[#FEE2E2] rounded-[8px] hover:bg-[#FECACA] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
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
            {isFiltered && ` (filtered from ${tasks.length})`}
          </p>
          {filtered.length === 0 ? (
            <EmptyState filtered={isFiltered} />
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
          tasks={tasks}
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
