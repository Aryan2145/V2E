'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { getNow } from '@/lib/clock'
import type { Task, TaskComment, TaskActivityLog, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
// import QuadrantBadge from '@/components/tasks/QuadrantBadge'
import AssigneeSelector from '@/components/tasks/AssigneeSelector'
import EditTaskModal from '@/components/tasks/EditTaskModal'
import StyledSelect from '@/components/ui/StyledSelect'
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Send,
  Link as LinkIcon,
  Calendar,
  User,
  Clock,
  CheckSquare,
  Eye,
  Pencil,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name) return ''
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]',
  'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]',
]
function avatarColor(name: string): string {
  if (!name) return avatarColors[0]
  let h = 0; for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function deadlineColor(deadline?: string): string {
  if (!deadline) return 'text-[#475569]'
  const d = new Date(deadline)
  const now = getNow()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (dl < today) return 'text-[#DC2626] font-semibold'
  if (dl.getTime() === today.getTime()) return 'text-[#D97706] font-semibold'
  return 'text-[#475569]'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-[#F1F5F9] rounded animate-pulse ${className ?? ''}`}
    />
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-2/3" />
      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="w-72 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Comment component ────────────────────────────────────────────────────────

function CommentItem({
  comment,
  orgId,
  taskId,
  currentUserId,
  onDeleted,
}: {
  comment: TaskComment
  orgId: string
  taskId: string
  currentUserId: string
  onDeleted: () => void
}) {
  async function handleDelete() {
    if (!confirm('Delete this comment?')) return
    await tasksApi.deleteComment(orgId, taskId, comment.id)
    onDeleted()
  }

  return (
    <div className="flex gap-3">
      <div
        className={[
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          comment.user_name
            ? `${avatarColor(comment.user_name)} text-white text-[10px] font-bold`
            : 'bg-[#E2E8F0]',
        ].join(' ')}
      >
        {comment.user_name ? getInitials(comment.user_name) : <User size={14} className="text-[#94A3B8]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[#0F172A]">{comment.user_name}</span>
          <span className="text-xs text-[#94A3B8]">{formatDate(comment.created_at)}</span>
        </div>
        <p className="mt-1 text-sm text-[#1E293B] leading-relaxed">{comment.body}</p>
      </div>
      {comment.user_id === currentUserId && (
        <button
          onClick={handleDelete}
          className="text-[#94A3B8] hover:text-[#DC2626] transition-colors shrink-0"
          title="Delete comment"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Activity log item ────────────────────────────────────────────────────────

function ActivityItem({ log }: { log: TaskActivityLog }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
        <Clock size={13} className="text-[#2563EB]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1E293B]">
          <span className="font-semibold">{log.performed_by_name}</span>{' '}
          <span className="text-[#475569]">{log.action.replace(/_/g, ' ')}</span>
        </p>
        {!!log.metadata?.reason && (
          <p className="text-xs text-[#475569] mt-0.5 italic">"{String(log.metadata.reason)}"</p>
        )}
        <p className="text-xs text-[#94A3B8] mt-0.5">{formatDate(log.created_at)}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabType = 'details' | 'activity'

export default function TaskDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const taskId = params.taskId as string

  const [task, setTask] = useState<Task | null>(null)
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('details')
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [proofUrl, setProofUrl] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedStatusId, setSelectedStatusId] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingAssignees, setEditingAssignees] = useState(false)
  const [editAssigneesList, setEditAssigneesList] = useState<import('@/lib/types/tasks').SelectedAssignee[]>([])
  const [savingAssignees, setSavingAssignees] = useState(false)
  const [reopenSecondsLeft, setReopenSecondsLeft] = useState(0)
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (!task?.reopen_expires_at) { setReopenSecondsLeft(0); return }
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(task.reopen_expires_at!).getTime() - getNow().getTime()) / 1000))
      setReopenSecondsLeft(secs)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [task?.reopen_expires_at])

  const loadTask = useCallback(async () => {
    if (!orgId || !taskId) return
    try {
      const [t, cats, pris, sts, cmts, logs] = await Promise.all([
        tasksApi.getTask(orgId, taskId).catch(() => null),
        tasksApi.getCategories(orgId).catch(() => []),
        tasksApi.getPriorities(orgId).catch(() => []),
        tasksApi.getStatuses(orgId).catch(() => []),
        tasksApi.getComments(orgId, taskId).catch(() => []),
        tasksApi.getLogs(orgId, taskId).catch(() => []),
      ])
      setTask(t)
      setCategories(cats)
      setPriorities(pris)
      setStatuses(sts)
      setComments(cmts)
      setActivityLogs(logs)
      if (t) setSelectedStatusId(t.status_id)
    } finally {
      setLoading(false)
    }
  }, [orgId, taskId])

  useEffect(() => { loadTask() }, [loadTask])

  async function handleStatusChange(newStatusId: string) {
    if (!task) return
    setSelectedStatusId(newStatusId)
    try {
      const updated = await tasksApi.updateTask(orgId, taskId, { status_id: newStatusId })
      setTask(updated)
    } catch {
      setSelectedStatusId(task.status_id)
    }
  }

  async function handleComplete() {
    setActionLoading('complete')
    try {
      const updated = await tasksApi.completeTask(orgId, taskId)
      setTask(updated)
      setSelectedStatusId(updated.status_id)
      await loadTask()
    } catch {
      // ignore
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReopen(reason?: string) {
    setActionLoading('reopen')
    try {
      const updated = await tasksApi.reopenTask(orgId, taskId, reason)
      setTask(updated)
      setSelectedStatusId(updated.status_id)
      setShowReopenModal(false)
      setReopenReason('')
      await loadTask()
    } catch {
      // ignore
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete() {
    setActionLoading('delete')
    try {
      await tasksApi.deleteTask(orgId, taskId, deleteReason || undefined)
      router.push('/dashboard/tasks')
    } catch {
      setActionLoading(null)
    }
  }

  async function handleToggleChecklist(itemId: string) {
    if (!task?.checklist) return
    const updated = await tasksApi.toggleChecklist(orgId, taskId, itemId).catch(() => null)
    if (updated) {
      setTask((prev) =>
        prev
          ? {
              ...prev,
              checklist: prev.checklist?.map((c) =>
                c.id === itemId ? { ...c, is_completed: !c.is_completed } : c
              ),
            }
          : prev
      )
    }
  }

  async function handleSendComment() {
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      const c = await tasksApi.addComment(orgId, taskId, commentText.trim())
      setComments((prev) => [...prev, c])
      setCommentText('')
    } finally {
      setSendingComment(false)
    }
  }

  async function handleSubmitProof() {
    if (!proofUrl.trim()) return
    setSubmittingProof(true)
    try {
      const updated = await tasksApi.submitProof(orgId, taskId, proofUrl.trim())
      setTask(updated)
      setProofUrl('')
    } finally {
      setSubmittingProof(false)
    }
  }

  async function handleSaveAssignees() {
    if (!task) return
    setSavingAssignees(true)
    try {
      const currentIds = new Set((task.assignees ?? []).map((a) => a.user_id))
      const newIds = new Set(editAssigneesList.map((a) => a.user_id))

      // Remove assignees that are no longer in the list
      const toRemove = Array.from(currentIds).filter((id) => !newIds.has(id))
      await Promise.all(toRemove.map((uid) => tasksApi.removeAssignee(orgId, taskId, uid).catch(() => null)))

      // Add new assignees
      const toAdd = editAssigneesList.filter((a) => !currentIds.has(a.user_id))
      await Promise.all(toAdd.map((a) => tasksApi.addAssignee(orgId, taskId, a.user_id, a.is_cc).catch(() => null)))

      // Update is_cc for existing (remove and re-add)
      const toUpdateCC = editAssigneesList.filter((a) => {
        const existing = (task.assignees ?? []).find((ea) => ea.user_id === a.user_id)
        return existing && existing.is_cc !== a.is_cc
      })
      await Promise.all(toUpdateCC.map(async (a) => {
        await tasksApi.removeAssignee(orgId, taskId, a.user_id).catch(() => null)
        await tasksApi.addAssignee(orgId, taskId, a.user_id, a.is_cc).catch(() => null)
      }))

      await loadTask()
      setEditingAssignees(false)
    } finally {
      setSavingAssignees(false)
    }
  }

  const isCompletedStatus = task?.status?.type === 'completed'
  const canDelete = user?.is_admin || task?.created_by_user_id === user?.id

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
      </div>
    )
  }

  if (loading) {
    return <DetailSkeleton />
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">Task not found</p>
        <button
          onClick={() => router.back()}
          className="mt-3 text-sm text-[#2563EB] hover:underline"
        >
          Back to Tasks
        </button>
      </div>
    )
  }

  const category = categories.find((c) => c.id === task.category_id) ?? task.category
  const priority = priorities.find((p) => p.id === task.priority_id) ?? task.priority
  const status = statuses.find((s) => s.id === selectedStatusId) ?? task.status
  const assignees = task.assignees?.filter((a) => !a.is_cc) ?? []
  const ccUsers = task.assignees?.filter((a) => a.is_cc) ?? []
  const currentUserIsCC = task.assignees?.some((a) => a.user_id === user?.id && a.is_cc) ?? false
  const isCreator = task.created_by_user_id === user?.id
  const canEdit = isCreator || user?.is_admin

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Back + actions row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-[#475569] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Tasks
        </button>
        <div className="flex items-center gap-2">
          {!isCompletedStatus && !currentUserIsCC ? (
            <button
              onClick={handleComplete}
              disabled={actionLoading === 'complete'}
              className="flex items-center gap-2 px-4 py-[8px] text-sm font-semibold text-white bg-[#16A34A] rounded-[8px] hover:bg-[#15803D] disabled:opacity-60 transition-colors"
            >
              <CheckCircle2 size={15} />
              {actionLoading === 'complete' ? 'Completing...' : 'Complete'}
            </button>
          ) : !currentUserIsCC && (
            isCreator ? (
              <button
                onClick={() => setShowReopenModal(true)}
                disabled={actionLoading === 'reopen'}
                className="flex items-center gap-2 px-4 py-[8px] text-sm font-semibold text-[#D97706] border border-[#FDE68A] bg-[#FEF9C3] rounded-[8px] hover:bg-[#FDE68A] disabled:opacity-60 transition-colors"
              >
                <RotateCcw size={15} />
                Reopen
              </button>
            ) : reopenSecondsLeft > 0 ? (
              <button
                onClick={() => handleReopen()}
                disabled={actionLoading === 'reopen'}
                className="flex items-center gap-2 px-4 py-[8px] text-sm font-semibold text-[#D97706] border border-[#FDE68A] bg-[#FEF9C3] rounded-[8px] hover:bg-[#FDE68A] disabled:opacity-60 transition-colors"
              >
                <RotateCcw size={15} />
                {actionLoading === 'reopen' ? 'Reopening...' : `Reopen (${formatCountdown(reopenSecondsLeft)})`}
              </button>
            ) : (
              <span className="flex items-center gap-2 px-4 py-[8px] text-sm font-semibold text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] rounded-[8px] cursor-default select-none">
                <CheckCircle2 size={15} className="text-[#94A3B8]" />
                Completed
              </span>
            )
          )}
          {canEdit && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-[8px] text-sm font-semibold text-[#475569] border border-[#CBD5E1] bg-white rounded-[8px] hover:bg-[#F8FAFC] transition-colors"
            >
              <Pencil size={15} />
              Edit
            </button>
          )}
          {canDelete && !showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-[8px] text-sm font-semibold text-white bg-[#DC2626] rounded-[8px] hover:bg-[#B91C1C] transition-colors"
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* CC banner */}
      {currentUserIsCC && (
        <div className="flex items-center gap-2 text-[13px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] px-3 py-2">
          <Eye size={14} className="shrink-0 text-[#D97706]" />
          You&apos;re CC&apos;d on this task — you can view and comment but cannot mark it complete.
        </div>
      )}

      {showEditModal && (
        <EditTaskModal
          task={task}
          categories={categories}
          priorities={priorities}
          statuses={statuses}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => { setTask(updated); setSelectedStatusId(updated.status_id); setShowEditModal(false) }}
        />
      )}

      {/* Reopen reason modal (creator only) */}
      {showReopenModal && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px] p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#D97706]">Reopen this task?</p>
            <p className="text-xs text-[#92400E] mt-0.5">As the task creator, a reason is required.</p>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Reason for reopening (required)"
              rows={2}
              className="mt-2 w-full border border-[#FDE68A] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none bg-white focus:border-[#D97706] resize-none"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleReopen(reopenReason)}
              disabled={actionLoading === 'reopen' || !reopenReason.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#D97706] rounded-[8px] hover:bg-[#B45309] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'reopen' ? 'Reopening...' : 'Confirm Reopen'}
            </button>
            <button
              onClick={() => { setShowReopenModal(false); setReopenReason('') }}
              className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[12px] p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#DC2626]">Delete this task?</p>
            <input
              type="text"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion (optional)"
              className="mt-2 w-full border border-[#FECACA] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none bg-white focus:border-[#DC2626]"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#DC2626] rounded-[8px] hover:bg-[#B91C1C] disabled:opacity-60 transition-colors"
            >
              {actionLoading === 'delete' ? 'Deleting...' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0]">
        {(['details', 'activity'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-5 py-2.5 text-sm font-medium transition-colors border-b-2',
              tab === t
                ? 'text-[#2563EB] border-[#2563EB]'
                : 'text-[#475569] border-transparent hover:text-[#0F172A]',
            ].join(' ')}
          >
            {t === 'details' ? 'Details' : 'Activity Log'}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left panel — 60% */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Title */}
            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">{task.title}</h1>

            {/* Description */}
            {task.description && (
              <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                <h3 className="text-[15px] font-semibold text-[#0F172A] mb-3">Description</h3>
                <p className="text-sm text-[#1E293B] leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Checklist */}
            {task.checklist && task.checklist.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                  <CheckSquare size={16} className="text-[#2563EB]" />
                  Checklist
                  <span className="text-sm font-normal text-[#475569]">
                    ({task.checklist.filter((c) => c.is_completed).length}/{task.checklist.length})
                  </span>
                </h3>
                <div className="space-y-2">
                  {task.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(item.id)}
                        className={[
                          'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                          item.is_completed
                            ? 'bg-[#16A34A] border-[#16A34A]'
                            : 'border-[#CBD5E1] hover:border-[#2563EB]',
                        ].join(' ')}
                        aria-checked={item.is_completed}
                        role="checkbox"
                      >
                        {item.is_completed && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className={`text-sm ${item.is_completed ? 'line-through text-[#94A3B8]' : 'text-[#1E293B]'}`}>
                        {item.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Proof section */}
            {task.proof_required && (
              <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
                <h3 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                  <LinkIcon size={15} className="text-[#2563EB]" />
                  Proof of Completion
                </h3>
                {task.proof_url ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={task.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#2563EB] hover:underline break-all"
                    >
                      {task.proof_url}
                    </a>
                    {task.proof_submitted_at && (
                      <span className="text-xs text-[#94A3B8] shrink-0">
                        Submitted {formatDate(task.proof_submitted_at)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                    />
                    <button
                      onClick={handleSubmitProof}
                      disabled={submittingProof || !proofUrl.trim()}
                      className="px-4 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
                    >
                      {submittingProof ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
              <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">
                Comments ({comments.length})
              </h3>
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-sm text-[#475569]">No comments yet. Be the first to comment.</p>
                ) : (
                  comments.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      orgId={orgId}
                      taskId={taskId}
                      currentUserId={user?.id ?? ''}
                      onDeleted={() => setComments((prev) => prev.filter((x) => x.id !== c.id))}
                    />
                  ))
                )}
              </div>
              {/* Comment input */}
              <div className="flex gap-2 items-end">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendComment()
                    }
                  }}
                  placeholder="Add a comment... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white resize-none"
                />
                <button
                  onClick={handleSendComment}
                  disabled={sendingComment || !commentText.trim()}
                  className="px-4 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0"
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Right panel — 40% */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">

            {/* Status */}
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#EFF6FF] border-b border-[#BFDBFE]">
                <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                <p className="text-[11px] font-bold text-[#2563EB] uppercase tracking-widest">Status</p>
              </div>
              <div className="p-4">
                <StyledSelect
                  value={selectedStatusId}
                  onChange={(v) => handleStatusChange(v)}
                  options={statuses.map((s) => ({ value: s.id, label: s.label, color: s.color }))}
                />
              </div>
            </div>

            {/* Details */}
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F3FF] border-b border-[#DDD6FE]">
                <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                <p className="text-[11px] font-bold text-[#7C3AED] uppercase tracking-widest">Details</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {status && (
                    <span
                      className="inline-flex items-center rounded-[8px] px-3 py-1.5 text-sm font-medium"
                      style={{ backgroundColor: status.color + '22', color: status.color, border: `1px solid ${status.color}44` }}
                    >
                      {status.label}
                    </span>
                  )}
                  {priority && (
                    <span
                      className="inline-flex items-center rounded-[8px] px-3 py-1.5 text-sm font-medium"
                      style={{ backgroundColor: priority.color + '22', color: priority.color, border: `1px solid ${priority.color}44` }}
                    >
                      {priority.label}
                    </span>
                  )}
                  {category && (
                    <span
                      className="inline-flex items-center rounded-[8px] px-3 py-1.5 text-sm font-medium"
                      style={{ backgroundColor: category.color + '22', color: category.color, border: `1px solid ${category.color}44` }}
                    >
                      {category.name}
                    </span>
                  )}
                </div>

                {task.deadline && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-[6px] bg-[#FEF9C3] flex items-center justify-center shrink-0">
                      <Calendar size={13} className="text-[#D97706]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Deadline</p>
                      <p className={`text-sm ${deadlineColor(task.deadline)}`}>{formatDate(task.deadline)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[6px] bg-[#F1F5F9] flex items-center justify-center shrink-0">
                    <Clock size={13} className="text-[#475569]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Created</p>
                    <p className="text-sm text-[#475569]">{formatDate(task.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#F0FDF4] border-b border-[#BBF7D0]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                  <p className="text-[11px] font-bold text-[#16A34A] uppercase tracking-widest">Assignees</p>
                </div>
                {!editingAssignees ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditAssigneesList((task.assignees ?? []).map((a) => ({
                        user_id: a.user_id,
                        name: a.user?.name ?? a.user_name ?? 'Unknown',
                        is_cc: a.is_cc,
                      })))
                      setEditingAssignees(true)
                    }}
                    className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAssignees}
                      disabled={savingAssignees}
                      className="text-xs font-semibold text-white bg-[#16A34A] px-2.5 py-1 rounded-[6px] hover:bg-[#15803D] disabled:opacity-60 transition-colors"
                    >
                      {savingAssignees ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAssignees(false)}
                      className="text-xs font-medium text-[#475569] hover:text-[#0F172A]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4">
                {editingAssignees ? (
                  <AssigneeSelector
                    orgId={orgId}
                    value={editAssigneesList}
                    onChange={setEditAssigneesList}
                    currentUser={user ? { user_id: user.id, name: user.name } : undefined}
                  />
                ) : (
                  <div className="space-y-3">
                    {assignees.map((a) => {
                      const name = a.user?.name ?? a.user_name ?? 'Unknown'
                      const email = a.user?.email ?? a.user_email ?? ''
                      return (
                        <div key={a.id} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                            {getInitials(name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0F172A] truncate">{name}</p>
                            <p className="text-xs text-[#475569] truncate">{email}</p>
                          </div>
                          {a.is_completed ? (
                            <CheckCircle2 size={14} className="text-[#16A34A] shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#CBD5E1] shrink-0" />
                          )}
                        </div>
                      )
                    })}
                    {ccUsers.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide pt-1">CC</p>
                        {ccUsers.map((a) => {
                          const name = a.user?.name ?? a.user_name ?? 'Unknown'
                          return (
                            <div key={a.id} className="flex items-center gap-3 opacity-70">
                              <div className={`w-8 h-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                {getInitials(name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#0F172A] truncate">{name}</p>
                              </div>
                              <span className="text-[10px] font-semibold bg-[#FEF9C3] text-[#D97706] border border-[#FDE68A] rounded px-1.5 py-0.5">CC</span>
                            </div>
                          )
                        })}
                      </>
                    )}
                    {assignees.length === 0 && ccUsers.length === 0 && (
                      <p className="text-sm text-[#475569]">No assignees yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Completion Mode */}
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A]">
                <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                <p className="text-[11px] font-bold text-[#D97706] uppercase tracking-widest">Completion Mode</p>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-[#0F172A]">
                  {task.completion_mode === 'all_must_complete'
                    ? 'All assignees must complete'
                    : 'Any assignee can complete'}
                </p>
              </div>
            </div>

            {task.proof_required && (
              <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${task.proof_url ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'}`}>
                  <span className={`w-2 h-2 rounded-full ${task.proof_url ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                  <p className={`text-[11px] font-bold uppercase tracking-widest ${task.proof_url ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    Proof Required
                  </p>
                </div>
                <div className="p-4">
                  <p className={`text-sm font-medium ${task.proof_url ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
                    {task.proof_url ? 'Submitted' : 'Pending submission'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">Activity Log</h3>
          {activityLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <User size={24} className="text-[#94A3B8] mb-3" />
              <p className="text-sm text-[#475569]">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityLogs.map((log) => (
                <ActivityItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
