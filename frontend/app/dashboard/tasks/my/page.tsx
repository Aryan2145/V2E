'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import KanbanView from '@/components/tasks/KanbanView'
import CalendarView from '@/components/tasks/CalendarView'
import { CheckSquare, Filter, LayoutList, Columns, CalendarDays } from 'lucide-react'

type ViewMode = 'list' | 'kanban' | 'calendar'

export default function MyTasksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = user?.organizationId ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)

  const rawView = searchParams.get('view')
  const viewMode: ViewMode = rawView === 'kanban' || rawView === 'calendar' ? rawView : 'list'
  function setViewMode(mode: ViewMode) {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'list') params.delete('view')
    else params.set('view', mode)
    router.replace(`/dashboard/tasks/my?${params.toString()}`)
  }

  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.getMyTasks(orgId).catch(() => []),
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
    ]).then(([t, c, p, s]) => {
      setTasks(t); setCategories(c); setPriorities(p); setStatuses(s)
    }).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status_id !== filterStatus) return false
    if (filterPriority !== 'all' && t.priority_id !== filterPriority) return false
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false
    return true
  }), [tasks, filterStatus, filterPriority, filterCategory])

  const isFiltered = filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all'

  async function handleStatusChange(taskId: string, newStatusId: string) {
    await tasksApi.updateTask(orgId, taskId, { status_id: newStatusId })
    loadData()
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
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
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">My Tasks</h1>
        <p className="mt-1 text-[15px] text-[#475569]">Tasks assigned to you.</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
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
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <CheckSquare size={24} className="text-[#94A3B8]" />
              </div>
              <p className="font-semibold text-[#0F172A]">{isFiltered ? 'No tasks match your filters' : 'No tasks assigned to you'}</p>
              <p className="text-sm text-[#475569] mt-1">{isFiltered ? 'Try adjusting your filters.' : 'Tasks assigned to you will appear here.'}</p>
            </div>
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
    </div>
  )
}
