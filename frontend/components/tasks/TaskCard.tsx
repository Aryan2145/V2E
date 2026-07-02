'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Calendar, GitBranch, MessageSquare, Paperclip, ChevronDown, Check } from 'lucide-react'
import { getNow } from '@/lib/clock'
import type { Task, TaskPriority, TaskStatus, TaskCategory } from '@/lib/types/tasks'
import AssigneeAvatars, { type AvatarPerson } from './AssigneeAvatars'
// import QuadrantBadge from './QuadrantBadge'

interface TaskCardProps {
  task: Task
  onClick: () => void
  priorities: TaskPriority[]
  statuses: TaskStatus[]
  categories: TaskCategory[]
  /** When provided, the status pill becomes a click-to-change control (no drill-in). */
  onStatusChange?: (statusId: string) => void | Promise<void>
  // The viewer's user id. Lets the row show who assigned the task and list the
  // OTHER assignees (everyone but the viewer). Omit on cross-org/collective views.
  currentUserId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deadlineClass(deadline?: string): string {
  if (!deadline) return 'text-[#475569]'
  const d = new Date(deadline)
  const now = getNow()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (dl < today) return 'text-[#DC2626] font-medium'
  if (dl.getTime() === today.getTime()) return 'text-[#D97706] font-medium'
  return 'text-[#475569]'
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date}, ${time}`
}

// Order statuses by their lifecycle phase, then their configured order — so the
// change menu reads Not started → In progress → Completed / Incomplete.
const PHASE_ORDER: Record<TaskStatus['type'], number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
  incomplete: 3,
}

// ─── Status change control ──────────────────────────────────────────────────────

function StatusControl({
  status,
  statuses,
  onChange,
}: {
  status: TaskStatus
  statuses: TaskStatus[]
  onChange: (statusId: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape. The menu is absolutely anchored to this
  // control (not a fixed portal), so it moves with the row and never drifts.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const ordered = [...statuses].sort(
    (a, b) => PHASE_ORDER[a.type] - PHASE_ORDER[b.type] || a.order_index - b.order_index,
  )

  async function pick(id: string) {
    setOpen(false)
    if (id === status.id) return
    try {
      setBusy(true)
      await onChange(id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-[999px] pl-2.5 pr-1.5 py-0.5 text-[11px] font-medium transition-shadow hover:shadow-sm disabled:opacity-60"
        style={{
          backgroundColor: status.color + '22',
          color: status.color,
          border: `1px solid ${status.color}44`,
        }}
      >
        {status.label}
        <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 w-52 max-h-64 overflow-y-auto rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1"
        >
          {ordered.map((s) => {
            const active = s.id === status.id
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-[#F1F5F9]' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate text-[#0F172A]">{s.label}</span>
                {active && <Check size={14} className="text-[#2563EB] shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskCard({ task, onClick, priorities, statuses, categories, onStatusChange, currentUserId }: TaskCardProps) {
  const priority = priorities.find((p) => p.id === task.priority_id)
  const status = statuses.find((s) => s.id === task.status_id) ?? task.status
  const category = categories.find((c) => c.id === task.category_id) ?? task.category

  const commentCount = task._count?.comments ?? 0
  const unread = task.unread_comments ?? 0
  const attachmentCount = task._count?.attachments ?? 0

  // Who assigned the task. Hidden when the viewer is the assigner (no "By me").
  const assignerName = task.created_by?.name ?? null
  const showAssigner = !!assignerName && task.created_by_user_id !== currentUserId

  // Other assignees = everyone but the viewer (primary first, then CC), each with
  // name/dept/role for the hover tooltip. When currentUserId is omitted, this is
  // simply the full assignee list.
  const otherPeople: AvatarPerson[] = [...(task.assignees ?? [])]
    .filter((a) => a.user_id !== currentUserId)
    .sort((a, b) => Number(a.is_cc) - Number(b.is_cc))
    .map((a) => ({
      id: a.id,
      name: a.user?.name ?? a.user_name ?? '?',
      department: a.user?.department,
      role: a.user?.role_title,
      isCC: a.is_cc,
    }))

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all duration-150 group"
    >
      {/* Title + Category + Priority */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate group-hover:text-[#2563EB] transition-colors">
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {category && (
            <span
              className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: category.color + '22',
                color: category.color,
                border: `1px solid ${category.color}44`,
              }}
            >
              {category.name}
            </span>
          )}
          {priority && (
            <span
              className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: priority.color + '22',
                color: priority.color,
                border: `1px solid ${priority.color}44`,
              }}
            >
              {priority.label}
            </span>
          )}
          {task.workflow_step?.show_on_card && (
            <span className="inline-flex items-center gap-0.5 rounded-[999px] px-2 py-0.5 text-[10px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              <GitBranch size={9} />
              {task.workflow_step.template_name} — Step {task.workflow_step.step_order}
            </span>
          )}
        </div>
      </div>

      {/* Meta cluster — chats (with unread) + attachments. Glanceable, no drill-in. */}
      <div className="shrink-0 flex items-center gap-3">
        {/* Chats / comments */}
        <div
          className="relative flex items-center gap-1 text-xs text-[#64748B]"
          title={
            commentCount === 0
              ? 'No comments'
              : `${commentCount} comment${commentCount !== 1 ? 's' : ''}${unread > 0 ? ` · ${unread} unread` : ''}`
          }
        >
          <MessageSquare size={14} className={unread > 0 ? 'text-[#2563EB]' : ''} />
          <span className={unread > 0 ? 'font-semibold text-[#2563EB]' : ''}>{commentCount}</span>
          {unread > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-[#2563EB] text-white text-[9px] font-bold leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>

        {/* Attachments — shows "None" when there are no files */}
        <div
          className="flex items-center gap-1 text-xs text-[#64748B]"
          title={attachmentCount === 0 ? 'No attachments' : `${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`}
        >
          <Paperclip size={14} className={attachmentCount === 0 ? 'text-[#CBD5E1]' : ''} />
          {attachmentCount === 0 ? <span className="text-[#94A3B8]">None</span> : <span>{attachmentCount}</span>}
        </div>
      </div>

      {/* People — a single clean line: who assigned it (muted) + the assignee
          avatars, or a "Self" tag when it's a task you assigned to yourself. */}
      <div className="shrink-0 flex items-center gap-2 justify-end max-w-[240px]">
        {showAssigner && (
          <span className="text-[11px] text-[#94A3B8] truncate max-w-[120px]" title={`Assigned by ${assignerName}`}>
            by {assignerName}
          </span>
        )}
        {otherPeople.length > 0 ? (
          <AssigneeAvatars people={otherPeople} max={3} size="sm" />
        ) : !showAssigner ? (
          <span className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            Self
          </span>
        ) : null}
      </div>

      {/* Deadline */}
      {task.deadline && (
        <div className={`shrink-0 flex items-center gap-1 text-xs ${deadlineClass(task.deadline)}`}>
          <Calendar size={12} />
          <span>{formatDeadline(task.deadline)}</span>
        </div>
      )}

      {/* Status — interactive change control when onStatusChange is provided, else a static pill */}
      {status && (
        onStatusChange ? (
          <StatusControl status={status} statuses={statuses} onChange={onStatusChange} />
        ) : (
          <div className="shrink-0">
            <span
              className="inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: status.color + '22',
                color: status.color,
                border: `1px solid ${status.color}44`,
              }}
            >
              {status.label}
            </span>
          </div>
        )
      )}
    </div>
  )
}
