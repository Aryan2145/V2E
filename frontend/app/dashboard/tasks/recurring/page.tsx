'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type {
  RecurringTemplate,
  RecurringScheduleEntry,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from '@/lib/types/tasks'
import type { EligibleAssigneesResponse } from '@/lib/types/tasks'
import AssigneeAvatars, { type AvatarPerson } from '@/components/tasks/AssigneeAvatars'
import type { ScheduleEntryDraft } from '@/components/tasks/ScheduleEntryRow'
import CreateTaskModal from '@/components/tasks/CreateTaskModal'
import EditRecurringModal from '@/components/tasks/EditRecurringModal'
import {
  RotateCcw, Play, Pause, Calendar, Users, Plus, Trash2, Edit2, Zap,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

// ─── Delete flow ──────────────────────────────────────────────────────────────

type DeleteMode = 'stop' | 'delete-future' | 'delete-all'

const DELETE_COPY: Record<DeleteMode, { title: string; body: string; confirm: string; danger: boolean }> = {
  stop: {
    title: 'Stop this recurring task?',
    body: 'No new tasks will be created from it. Every task it already created stays untouched. You can Resume it any time.',
    confirm: 'Stop',
    danger: false,
  },
  'delete-future': {
    title: 'Stop and remove open tasks?',
    body: 'No new tasks will be created, and its still-open tasks are removed. Tasks that were already completed or closed are kept.',
    confirm: 'Stop & remove open tasks',
    danger: true,
  },
  'delete-all': {
    title: 'Delete everything?',
    body: 'The recurring task AND every task it ever created — including completed ones — will be deleted. This cannot be undone.',
    confirm: 'Delete everything',
    danger: true,
  },
}

function DeleteConfirmDialog({
  template,
  mode,
  onCancel,
  onConfirm,
}: {
  template: RecurringTemplate
  mode: DeleteMode
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = DELETE_COPY[mode]
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E2E8F0] p-5">
        <h3 className="text-[16px] font-semibold text-[#0F172A]">{copy.title}</h3>
        <p className="text-sm text-[#475569] mt-1.5">
          <span className="font-medium text-[#0F172A]">“{template.title}”</span> — {copy.body}
        </p>
        {error && (
          <div className="mt-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-3 py-2 text-sm text-[#DC2626]">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onConfirm()
              } catch {
                setError('Could not do this — you may not have permission to delete this recurring task.')
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy}
            className={[
              'px-4 py-2 text-sm font-semibold text-white rounded-[8px] disabled:opacity-60 transition-colors',
              copy.danger ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#2563EB] hover:bg-[#1D4ED8]',
            ].join(' ')}
          >
            {busy ? 'Working…' : copy.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
  userMap,
}: {
  template: RecurringTemplate
  onEdit: () => void
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onDelete: (mode: DeleteMode) => void
  onSpawnToday: () => Promise<{ spawned: number }>
  onClick: () => void
  userMap: Map<string, { name: string; department?: string; role?: string }>
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

  const toPerson = (uid: string, isCC: boolean): AvatarPerson => {
    const u = userMap.get(uid)
    return { id: uid, name: u?.name ?? '?', department: u?.department, role: u?.role, isCC }
  }
  const people: AvatarPerson[] = [
    ...(template.assignee_user_ids ?? []).map((uid) => toPerson(uid, false)),
    ...(template.cc_user_ids ?? []).map((uid) => toPerson(uid, true)),
  ]

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all duration-150 group"
    >
      {/* Header: badges + actions on top row, title full-width below */}
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2 flex-wrap">
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
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-[#E2E8F0] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] p-1.5 min-w-[220px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteMenu(false); onDelete('stop') }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F1F5F9]"
                >
                  <span className="block text-sm font-medium text-[#0F172A]">Stop (keep all tasks)</span>
                  <span className="block text-[11px] text-[#475569]">No new tasks; existing ones stay</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteMenu(false); onDelete('delete-future') }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#FEE2E2]"
                >
                  <span className="block text-sm font-medium text-[#DC2626]">Stop & remove open tasks</span>
                  <span className="block text-[11px] text-[#475569]">Completed ones are kept</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteMenu(false); onDelete('delete-all') }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#FEE2E2]"
                >
                  <span className="block text-sm font-medium text-[#DC2626]">Delete everything</span>
                  <span className="block text-[11px] text-[#475569]">Removes it and every task it created</span>
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
        <h3 className="text-[15px] font-semibold text-[#0F172A] break-words group-hover:text-[#2563EB] transition-colors">{template.title}</h3>
        {template.description && (
          <p className="text-sm text-[#475569] mt-0.5 line-clamp-2">{template.description}</p>
        )}
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
        <span>By {template.created_by_name ?? 'Unknown'}</span>
        <span className="text-[#CBD5E1]">·</span>
        {earliestStart && (
          <>
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-[#94A3B8]" />
              <span>From {formatDate(earliestStart)}</span>
            </div>
            <span className="text-[#CBD5E1]">·</span>
          </>
        )}
        <span>{totalOccurrences} occurrence{totalOccurrences !== 1 ? 's' : ''}</span>
      </div>


      {/* Assignee avatars */}
      {people.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Users size={12} className="text-[#94A3B8]" />
          <AssigneeAvatars people={people} max={5} size="sm" />
          <span className="text-xs text-[#475569]">
            {template.assignee_user_ids.length} assignee{template.assignee_user_ids.length !== 1 ? 's' : ''}
            {(template.cc_user_ids?.length ?? 0) > 0 && ` · ${template.cc_user_ids.length} CC`}
          </span>
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
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [userMap, setUserMap] = useState<Map<string, { name: string; department?: string; role?: string }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ template: RecurringTemplate; mode: DeleteMode } | null>(null)

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.getRecurringTemplates(orgId).catch(() => [] as RecurringTemplate[]),
      tasksApi.getCategories(orgId).catch(() => [] as TaskCategory[]),
      tasksApi.getPriorities(orgId).catch(() => [] as TaskPriority[]),
      tasksApi.getStatuses(orgId).catch(() => [] as TaskStatus[]),
      tasksApi.getEligibleAssignees(orgId).catch(() => ({ departments: [], total: 0 } as EligibleAssigneesResponse)),
    ]).then(([t, c, p, s, eligible]) => {
      setTemplates(t); setCategories(c); setPriorities(p); setStatuses(s)
      const map = new Map<string, { name: string; department?: string; role?: string }>()
      eligible.departments.forEach((dept) =>
        dept.users.forEach((u) => map.set(u.user_id, { name: u.name, department: u.department_name, role: u.role_title })),
      )
      setUserMap(map)
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

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return
    const { template, mode } = deleteTarget
    await tasksApi.deleteRecurring(orgId, template.id, mode)
    if (mode === 'delete-all') {
      // The template row itself is gone.
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
    } else {
      // stop / delete-future keep the template around, just deactivated.
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, is_active: false } : t)))
    }
    setDeleteTarget(null)
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
              onDelete={(mode) => setDeleteTarget({ template: t, mode })}
              onSpawnToday={() => tasksApi.spawnTodayRecurring(orgId, t.id).then((r) => { loadData(); return r })}
              userMap={userMap}
            />
          ))}
        </div>
      )}

      {/* Same full-featured Create Task modal as everywhere else, locked to
          Recurring — checklists, reminders, attachments, proof and escalation
          all included (the old stripped-down recurring form is gone). */}
      <CreateTaskModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); loadData() }}
        categories={categories}
        priorities={priorities}
        statuses={statuses}
        initialMode="recurring"
        lockMode
      />

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

      {deleteTarget && (
        <DeleteConfirmDialog
          template={deleteTarget.template}
          mode={deleteTarget.mode}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirmed}
        />
      )}
    </div>
  )
}
