'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import KanbanView from '@/components/tasks/KanbanView'
import CalendarView from '@/components/tasks/CalendarView'
import CreateTaskModal from '@/components/tasks/CreateTaskModal'
import TaskFilterBar, { type TaskFilters, EMPTY_TASK_FILTERS, isTaskFiltered, applyTaskFilters } from '@/components/tasks/TaskFilterBar'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Plus, UserCheck, LayoutList, Columns, CalendarDays, AlertCircle } from 'lucide-react'

type ViewMode = 'list' | 'kanban' | 'calendar'

// Surface the backend's real message (completion gate, already-closed, etc.).
function apiErrorMessage(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(m)) return m[0] ?? fallback
  return typeof m === 'string' && m ? m : fallback
}

export default function AssignedByMePage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()
  const orgId = user?.organizationId ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const rawView = searchParams.get('view')
  const viewMode: ViewMode = rawView === 'kanban' || rawView === 'calendar' ? rawView : 'list'
  function setViewMode(mode: ViewMode) {
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'list') params.delete('view')
    else params.set('view', mode)
    router.replace(`/dashboard/tasks/assigned?${params.toString()}`)
  }

  const [filters, setFilters] = useState<TaskFilters>({ ...EMPTY_TASK_FILTERS })

  // Assigner-side close controls. Mark Incomplete captures a required reason in a
  // popup here; Mark Complete closes it outright, or sends the assigner to the task
  // page when a clean close isn't possible from the list (gate / pending parts).
  const [incompleteTask, setIncompleteTask] = useState<Task | null>(null)
  const [incompleteReason, setIncompleteReason] = useState('')
  const [incompleteSubmitting, setIncompleteSubmitting] = useState(false)

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.getAssignedByMe(orgId).catch(() => []),
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
    ]).then(([t, c, p, s]) => {
      setTasks(t); setCategories(c); setPriorities(p); setStatuses(s)
    }).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => applyTaskFilters(tasks, filters, statuses), [tasks, filters, statuses])
  const isFiltered = isTaskFiltered(filters)

  // As the assigner, try to close the task straight from the row. When a clean close
  // isn't possible from here — a checklist/proof gate, or a multi-person task with
  // pending parts that needs the proper confirm — take the assigner to the task page.
  async function handleComplete(task: Task) {
    try {
      const updated = await tasksApi.completeTask(orgId, task.id)
      setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t)))
      addToast('Task marked complete.', 'success')
    } catch (e) {
      const msg = apiErrorMessage(e, 'Could not complete this task from here.')
      addToast(`${msg} Opening the task to finish closing it.`, 'warning')
      router.push(`/dashboard/tasks/${task.id}`)
    }
  }

  // The assigner closing a task as not-done always closes the WHOLE task (a reason is
  // required) — unlike My Tasks, there's no "just my part" here.
  async function submitIncomplete() {
    if (!incompleteTask) return
    const reason = incompleteReason.trim()
    if (!reason) { addToast('A reason is required to mark a task incomplete.', 'warning'); return }
    setIncompleteSubmitting(true)
    try {
      const updated = await tasksApi.markIncomplete(orgId, incompleteTask.id, reason)
      setTasks((ts) => ts.map((t) => (t.id === incompleteTask.id ? updated : t)))
      addToast('Task marked incomplete.', 'success')
      setIncompleteTask(null)
      setIncompleteReason('')
    } catch (e) {
      addToast(apiErrorMessage(e, 'Could not mark this task incomplete.'), 'error')
    } finally {
      setIncompleteSubmitting(false)
    }
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Assigned by Me</h1>
          <p className="mt-1 text-[15px] text-[#475569]">Tasks you have created and assigned to others.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-[10px] bg-[#2563EB] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0"
        >
          <Plus size={16} />
          Create Task
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between flex-wrap">
        {viewMode !== 'calendar' && (
          <TaskFilterBar
            tasks={tasks}
            statuses={statuses}
            priorities={priorities}
            categories={categories}
            filters={filters}
            onChange={setFilters}
          />
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
                <UserCheck size={24} className="text-[#94A3B8]" />
              </div>
              <p className="font-semibold text-[#0F172A]">{isFiltered ? 'No tasks match your filters' : 'No tasks assigned by you'}</p>
              <p className="text-sm text-[#475569] mt-1">{isFiltered ? 'Try adjusting your filters.' : 'Tasks you create and assign to others will appear here.'}</p>
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
                  onComplete={() => handleComplete(task)}
                  onMarkIncomplete={() => { setIncompleteReason(''); setIncompleteTask(task) }}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {viewMode === 'kanban' && (
        <KanbanView
          orgId={orgId}
          tasks={filtered}
          statuses={statuses}
          priorities={priorities}
          categories={categories}
          perspective="owner"
          currentUserId={user?.id}
          onChanged={(u) => setTasks((ts) => ts.map((t) => (t.id === u.id ? u : t)))}
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

      {/* Mark-incomplete reason popup — the assigner closes the whole task as not-done. */}
      <Modal
        isOpen={!!incompleteTask}
        onClose={() => { if (!incompleteSubmitting) { setIncompleteTask(null); setIncompleteReason('') } }}
        title="Mark task incomplete"
        size="md"
        closeOnEscape={!incompleteSubmitting}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-[#FEF9C3] border border-[#FDE68A]">
            <AlertCircle size={15} className="text-[#CA8A04] shrink-0 mt-0.5" />
            <p className="text-xs text-[#854D0E]">
              This closes the task as not-done for everyone. A reason is required.
            </p>
          </div>

          {incompleteTask && (
            <p className="text-sm font-semibold text-[#0F172A] truncate">{incompleteTask.title}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#475569] mb-1.5">Reason</label>
            <textarea
              value={incompleteReason}
              onChange={(e) => setIncompleteReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Why is this being closed as not-done?"
              className="w-full rounded-[8px] border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-none"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setIncompleteTask(null); setIncompleteReason('') }}
              disabled={incompleteSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-[#475569] rounded-[8px] hover:bg-[#F1F5F9] disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitIncomplete}
              disabled={incompleteSubmitting || !incompleteReason.trim()}
              className="w-full sm:w-auto px-5 py-2 text-sm font-semibold text-white bg-[#DC2626] rounded-[8px] hover:bg-[#B91C1C] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
            >
              {incompleteSubmitting ? 'Saving…' : 'Mark Incomplete'}
            </button>
          </div>
        </div>
      </Modal>

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
