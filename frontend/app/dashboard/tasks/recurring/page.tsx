'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type {
  RecurringTemplate,
  RecurringScheduleEntry,
  TaskCategory,
  TaskPriority,
  CompletionMode,
  YearlyDate,
} from '@/lib/types/tasks'
import type { SelectedAssignee } from '@/lib/types/tasks'
import AssigneeSelector from '@/components/tasks/AssigneeSelector'
import ScheduleEntryList from '@/components/tasks/ScheduleEntryList'
import type { ScheduleEntryDraft } from '@/components/tasks/ScheduleEntryRow'
import EditRecurringModal from '@/components/tasks/EditRecurringModal'
import {
  RotateCcw, Play, Pause, Calendar, Users, Plus, X, Trash2, Edit2, Info, Zap,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const avatarColors = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]',
  'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]',
]
function avatarColor(str: string): string {
  let h = 0; for (let i = 0; i < str.length; i++) h += str.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}

function entryLabel(entry: RecurringScheduleEntry | ScheduleEntryDraft): string {
  const e = entry as RecurringScheduleEntry
  switch (e.schedule_type) {
    case 'daily':
      return `Every ${e.every > 1 ? `${e.every} days` : 'day'}`
    case 'weekly': {
      const days = Array.isArray(e.days) ? (e.days as number[]).map((d) => DOW[d]).join(', ') : ''
      return `Every ${e.every > 1 ? `${e.every} weeks` : 'week'}${days ? ` on ${days}` : ''}`
    }
    case 'monthly': {
      const md = Array.isArray(e.month_days) ? (e.month_days as number[]) : []
      const dayStr = md.length === 0 ? '?' : md.length <= 3 ? md.join(', ') : `${md.slice(0, 3).join(', ')}…`
      return `Day${md.length !== 1 ? 's' : ''} ${dayStr} every ${e.every > 1 ? `${e.every} months` : 'month'}`
    }
    case 'yearly': {
      const dates = Array.isArray(e.yearly_dates) ? (e.yearly_dates as { month: number; day: number }[]) : []
      if (dates.length === 0) return 'Yearly'
      if (dates.length === 1) return `${MONTHS_SHORT[dates[0].month - 1]} ${dates[0].day} each year`
      return `${dates.length} dates each year`
    }
    default:
      return e.schedule_type
  }
}

function scheduleLabel(t: RecurringTemplate): string {
  const entries = t.schedule_entries ?? []
  if (entries.length === 0) return 'No schedule'
  if (entries.length === 1) return entryLabel(entries[0])
  return `${entries.length} schedules`
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function defaultEntry(): ScheduleEntryDraft {
  return {
    schedule_type: 'daily',
    every: 1,
    days: [],
    month_days: [],
    yearly_dates: [],
    time: '09:00',
    start_date: new Date().toISOString().slice(0, 10),
    end_condition: 'never',
    end_date: '',
    end_after: 10,
  }
}

function entryToScheduleEntryDraft(e: RecurringScheduleEntry): ScheduleEntryDraft {
  return {
    schedule_type: e.schedule_type,
    every: e.every,
    days: (e.days as number[]) ?? [],
    month_days: (e.month_days as number[]) ?? [],
    yearly_dates: (e.yearly_dates as YearlyDate[]) ?? [],
    time: e.time,
    start_date: new Date(e.start_date).toISOString().slice(0, 10),
    end_condition: e.end_condition,
    end_date: e.end_date ? new Date(e.end_date).toISOString().slice(0, 10) : '',
    end_after: e.end_after ?? 10,
  }
}

// ─── Create modal ─────────────────────────────────────────────────────────────

interface CreateRecurringModalProps {
  orgId: string
  categories: TaskCategory[]
  priorities: TaskPriority[]
  onClose: () => void
  onCreated: (t: RecurringTemplate) => void
}

function CreateRecurringModal({ orgId, categories, priorities, onClose, onCreated }: CreateRecurringModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [completionMode, setCompletionMode] = useState<CompletionMode>('any_can_complete')
  const [proofRequired, setProofRequired] = useState(false)
  const [assignees, setAssignees] = useState<SelectedAssignee[]>([])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryDraft[]>([defaultEntry()])

  const primaryAssigneeCount = assignees.filter((a) => !a.is_cc).length

  useEffect(() => {
    if (primaryAssigneeCount <= 1) setCompletionMode('any_can_complete')
  }, [primaryAssigneeCount])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }

    for (const entry of scheduleEntries) {
      if (entry.schedule_type === 'weekly' && entry.days.length === 0) {
        setError('Select at least one day of the week for each weekly schedule.'); return
      }
      if (entry.schedule_type === 'monthly' && entry.month_days.length === 0) {
        setError('Select at least one day of the month for each monthly schedule.'); return
      }
      if (entry.end_condition === 'on_date' && !entry.end_date) {
        setError('End date is required for schedule entries with "On date" end condition.'); return
      }
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await tasksApi.createRecurring(orgId, {
        title: title.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        priority_id: priorityId || undefined,
        schedule_entries: scheduleEntries.map((e, idx) => ({
          schedule_type: e.schedule_type,
          every: e.every,
          days: e.days,
          month_days: e.month_days,
          yearly_dates: e.yearly_dates,
          time: e.time,
          start_date: e.start_date,
          end_condition: e.end_condition,
          end_date: e.end_condition === 'on_date' ? e.end_date : undefined,
          end_after: e.end_condition === 'after_n' ? e.end_after : undefined,
          order_index: idx,
        })),
        completion_mode: completionMode,
        proof_required: proofRequired,
        assignee_user_ids: assignees.filter((a) => !a.is_cc).map((a) => a.user_id),
        cc_user_ids: assignees.filter((a) => a.is_cc).map((a) => a.user_id),
      })
      onCreated(result)
    } catch {
      setError('Failed to create recurring template. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E2E8F0] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="text-[22px] font-semibold text-[#0F172A]">Create Recurring Task</h2>
            <p className="text-sm text-[#475569] mt-0.5">Set a schedule and a task will be created automatically.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {error && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3 text-sm text-[#DC2626]">
              {error}
            </div>
          )}

          {/* ── Task Details ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Task Details</p>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Title <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly team standup report"
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              />
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Assignees</label>
              <AssigneeSelector orgId={orgId} value={assignees} onChange={setAssignees} />
            </div>

            {/* Completion mode — only when multiple non-CC assignees */}
            {primaryAssigneeCount > 1 && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Completion Mode</label>
                <div className="flex gap-4">
                  {(['any_can_complete', 'all_must_complete'] as CompletionMode[]).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="completionMode"
                        value={mode}
                        checked={completionMode === mode}
                        onChange={() => setCompletionMode(mode)}
                        className="accent-[#2563EB]"
                      />
                      <span className="text-sm text-[#1E293B]">
                        {mode === 'any_can_complete' ? 'Any assignee can complete' : 'All must complete'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={2}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white resize-none"
              />
            </div>

            {/* Priority + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Priority</label>
                <select
                  value={priorityId}
                  onChange={(e) => setPriorityId(e.target.value)}
                  className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                >
                  <option value="">No priority</option>
                  {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                >
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Schedule Entries ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Schedule</p>
            <ScheduleEntryList entries={scheduleEntries} onChange={setScheduleEntries} />
          </div>

          {/* ── Completion settings ────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Completion</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProofRequired((v) => !v)}
                className={['relative w-10 h-5 rounded-full transition-colors', proofRequired ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'].join(' ')}
                role="switch"
                aria-checked={proofRequired}
              >
                <span className={['absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', proofRequired ? 'translate-x-5' : ''].join(' ')} />
              </button>
              <span className="text-sm text-[#1E293B] font-medium">Proof of completion required</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-[10px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Recurring Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template card ─────────────────────────────────────────────────────────────

function RecurringCard({
  template,
  onEdit,
  onPause,
  onResume,
  onDelete,
  onSpawnToday,
  onClick,
}: {
  template: RecurringTemplate
  onEdit: () => void
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onDelete: () => void
  onSpawnToday: () => Promise<{ spawned: number }>
  onClick: () => void
}) {
  const [toggling, setToggling] = useState(false)
  const [spawning, setSpawning] = useState(false)
  const [spawnMsg, setSpawnMsg] = useState<string | null>(null)
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      if (template.is_active) await onPause()
      else await onResume()
    } finally {
      setToggling(false)
    }
  }

  async function handleSpawnToday() {
    setSpawning(true)
    setSpawnMsg(null)
    try {
      const result = await onSpawnToday()
      setSpawnMsg(result.spawned > 0 ? `${result.spawned} task${result.spawned !== 1 ? 's' : ''} created` : 'Already spawned today')
    } catch {
      setSpawnMsg('Failed')
    } finally {
      setSpawning(false)
      setTimeout(() => setSpawnMsg(null), 3000)
    }
  }

  const entries = template.schedule_entries ?? []
  const earliestStart = entries.length > 0
    ? entries.reduce((min, e) => e.start_date < min ? e.start_date : min, entries[0].start_date)
    : null
  const totalOccurrences = entries.reduce((sum, e) => sum + (e.occurrence_count ?? 0), 0)

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all duration-150 group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={[
              'inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium',
              template.is_active
                ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
            ].join(' ')}>
              {template.is_active ? 'Active' : 'Paused'}
            </span>
            {entries.length > 1 && (
              <span className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                {entries.length} schedules
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold text-[#0F172A] truncate group-hover:text-[#2563EB] transition-colors">{template.title}</h3>
          {template.description && (
            <p className="text-sm text-[#475569] mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Edit button */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            title="Edit template"
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
          >
            <Edit2 size={13} />
          </button>
          {/* Run today button */}
          {template.is_active && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSpawnToday() }}
              disabled={spawning}
              title="Spawn today's task now"
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-[8px] text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] hover:bg-[#DBEAFE] disabled:opacity-60 transition-colors"
            >
              <Zap size={11} />
              {spawning ? '...' : spawnMsg ?? 'Run Today'}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggle() }}
            disabled={toggling}
            className={[
              'flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-[8px] transition-colors disabled:opacity-60',
              template.is_active
                ? 'text-[#D97706] bg-[#FEF9C3] border border-[#FDE68A] hover:bg-[#FDE68A]'
                : 'text-[#16A34A] bg-[#DCFCE7] border border-[#BBF7D0] hover:bg-[#BBF7D0]',
            ].join(' ')}
          >
            {template.is_active ? <Pause size={11} /> : <Play size={11} />}
            {toggling ? '...' : template.is_active ? 'Pause' : 'Resume'}
          </button>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteMenu((v) => !v) }}
              className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
            >
              <Trash2 size={13} />
            </button>
            {showDeleteMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#E2E8F0] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] p-1.5 min-w-[180px]">
                <button
                  onClick={() => { setShowDeleteMenu(false); onDelete() }}
                  className="w-full text-left px-3 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2] rounded-[6px]"
                >
                  Stop (keep instances)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule info */}
      <div className="space-y-1 mb-3">
        {entries.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No schedule configured</p>
        ) : entries.length === 1 ? (
          <div className="flex items-center gap-1.5 text-sm text-[#475569]">
            <RotateCcw size={12} className="text-[#94A3B8] shrink-0" />
            <span>{scheduleLabel(template)}</span>
          </div>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-[#475569]">
              <RotateCcw size={12} className="text-[#94A3B8] shrink-0" />
              <span>{entryLabel(entry)}</span>
            </div>
          ))
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#475569]">
        {earliestStart && (
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-[#94A3B8]" />
            <span>From {formatDate(earliestStart)}</span>
          </div>
        )}
        <span className="text-[#CBD5E1]">·</span>
        <span>{totalOccurrences} occurrence{totalOccurrences !== 1 ? 's' : ''}</span>
      </div>

      {/* Assignee avatars */}
      {template.assignee_user_ids?.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Users size={12} className="text-[#94A3B8]" />
          <div className="flex -space-x-1.5">
            {template.assignee_user_ids.slice(0, 5).map((uid) => (
              <div
                key={uid}
                className={`w-5 h-5 rounded-full ${avatarColor(uid)} flex items-center justify-center text-white text-[8px] font-bold border-2 border-white`}
              />
            ))}
            {template.assignee_user_ids.length > 5 && (
              <div className="w-5 h-5 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] text-[8px] font-bold border-2 border-white">
                +{template.assignee_user_ids.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-[#475569]">{template.assignee_user_ids.length} assignee{template.assignee_user_ids.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null)

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.getRecurringTemplates(orgId).catch(() => [] as RecurringTemplate[]),
      tasksApi.getCategories(orgId).catch(() => [] as TaskCategory[]),
      tasksApi.getPriorities(orgId).catch(() => [] as TaskPriority[]),
    ]).then(([t, c, p]) => {
      setTemplates(t); setCategories(c); setPriorities(p)
    }).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  async function handlePause(id: string) {
    await tasksApi.pauseRecurring(orgId, id)
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, is_active: false } : t))
  }

  async function handleResume(id: string) {
    await tasksApi.resumeRecurring(orgId, id)
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, is_active: true } : t))
  }

  async function handleDelete(id: string) {
    await tasksApi.deleteRecurring(orgId, id, 'stop')
    setTemplates((prev) => prev.filter((t) => t.id !== id))
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Recurring Tasks</h1>
          <p className="mt-1 text-[15px] text-[#475569]">
            Scheduled templates that automatically spawn new task instances.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-[10px] bg-[#2563EB] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0"
        >
          <Plus size={16} />
          New Recurring Task
        </button>
      </div>

      <p className="text-sm text-[#475569]">
        {templates.length} template{templates.length !== 1 ? 's' : ''}
      </p>

      {templates.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <RotateCcw size={24} className="text-[#94A3B8]" />
          </div>
          <p className="font-semibold text-[#0F172A]">No recurring templates yet</p>
          <p className="text-sm text-[#475569] mt-1 mb-5">
            Set up a schedule and tasks will be created automatically.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-[10px] bg-[#2563EB] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            <Plus size={16} />
            New Recurring Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <RecurringCard
              key={t.id}
              template={t}
              onClick={() => router.push(`/dashboard/tasks/recurring/${t.id}`)}
              onEdit={() => setEditingTemplate(t)}
              onPause={() => handlePause(t.id)}
              onResume={() => handleResume(t.id)}
              onDelete={() => handleDelete(t.id)}
              onSpawnToday={() => tasksApi.spawnTodayRecurring(orgId, t.id).then((r) => { loadData(); return r })}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRecurringModal
          orgId={orgId}
          categories={categories}
          priorities={priorities}
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setTemplates((prev) => [t, ...prev])
            setShowCreate(false)
          }}
        />
      )}

      {editingTemplate && (
        <EditRecurringModal
          template={editingTemplate}
          orgId={orgId}
          categories={categories}
          priorities={priorities}
          onClose={() => setEditingTemplate(null)}
          onUpdated={(updated) => {
            setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t))
            setEditingTemplate(null)
          }}
        />
      )}
    </div>
  )
}
