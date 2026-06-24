'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Trash2, Clock } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { holidaysApi } from '@/lib/api/holidays'
import type { Task, TaskCategory, TaskPriority, TaskStatus, CompletionMode } from '@/lib/types/tasks'
import type { SelectedAssignee } from '@/lib/types/tasks'
import type { HolidayCheckResult } from '@/lib/types/holidays'
// import QuadrantBadge from './QuadrantBadge'
import AssigneeSelector from './AssigneeSelector'
import HolidayWarningBadge from '@/components/holidays/HolidayWarningBadge'

interface ChecklistEntry {
  title: string
}

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  onTaskCreated?: (task: Task) => void
  categories: TaskCategory[]
  priorities: TaskPriority[]
  statuses: TaskStatus[]
}

// const quadrants: { value: TaskQuadrant; label: string; sublabel: string }[] = [
//   { value: 'Q1', label: 'Q1', sublabel: 'Urgent + Important' },
//   { value: 'Q2', label: 'Q2', sublabel: 'Not Urgent + Important' },
//   { value: 'Q3', label: 'Q3', sublabel: 'Urgent + Not Important' },
//   { value: 'Q4', label: 'Q4', sublabel: 'Not Urgent + Not Important' },
// ]
// const quadrantColors: Record<TaskQuadrant, { bg: string; text: string; border: string; activeBg: string }> = {
//   Q1: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]', activeBg: 'bg-[#DC2626]' },
//   Q2: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]', activeBg: 'bg-[#2563EB]' },
//   Q3: { bg: 'bg-[#FEF9C3]', text: 'text-[#D97706]', border: 'border-[#FDE68A]', activeBg: 'bg-[#D97706]' },
//   Q4: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', border: 'border-[#E5E7EB]', activeBg: 'bg-[#6B7280]' },
// }

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreated,
  onTaskCreated,
  categories,
  priorities,
  statuses,
}: CreateTaskModalProps) {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // const [quadrant, setQuadrant] = useState<TaskQuadrant>('Q2')
  const [priorityId, setPriorityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  // Convert the user's local date+time to an ISO instant so the backend stores the
  // exact moment regardless of the server's timezone (EC2 runs UTC, local runs IST).
  const deadline = deadlineDate
    ? new Date(deadlineTime ? `${deadlineDate}T${deadlineTime}` : `${deadlineDate}T23:59`).toISOString()
    : ''
  const todayStr = new Date().toISOString().split('T')[0]
  const [completionMode, setCompletionMode] = useState<CompletionMode>('any_can_complete')
  const [proofRequired, setProofRequired] = useState(false)
  const [assignees, setAssignees] = useState<SelectedAssignee[]>([])
  const [checklist, setChecklist] = useState<ChecklistEntry[]>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holidayCheck, setHolidayCheck] = useState<HolidayCheckResult | null>(null)
  const holidayDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Portal target only exists on the client — guard against SSR mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const primaryAssigneeCount = assignees.filter((a) => !a.is_cc).length

  useEffect(() => {
    if (primaryAssigneeCount <= 1) setCompletionMode('any_can_complete')
  }, [primaryAssigneeCount])

  // Set default status
  useEffect(() => {
    if (statuses.length > 0 && !statusId) {
      const def = statuses.find((s) => s.is_default) ?? statuses[0]
      setStatusId(def.id)
    }
  }, [statuses, statusId])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Holiday check on deadline change (debounced 300ms)
  useEffect(() => {
    if (holidayDebounceRef.current) clearTimeout(holidayDebounceRef.current)
    if (!deadlineDate || !orgId) { setHolidayCheck(null); return }
    holidayDebounceRef.current = setTimeout(async () => {
      try {
        const result = await holidaysApi.checkDate(orgId, deadlineDate)
        setHolidayCheck(result)
      } catch {
        setHolidayCheck(null)
      }
    }, 300)
    return () => { if (holidayDebounceRef.current) clearTimeout(holidayDebounceRef.current) }
  }, [deadlineDate, orgId])

  const reset = useCallback(() => {
    setTitle('')
    setDescription('')
    // setQuadrant('Q2')
    setPriorityId('')
    setCategoryId('')
    setStatusId(statuses.find((s) => s.is_default)?.id ?? statuses[0]?.id ?? '')
    setDeadlineDate('')
    setDeadlineTime('')
    setCompletionMode('any_can_complete')
    setProofRequired(false)
    setAssignees([])
    setChecklist([])
    setNewChecklistItem('')
    setError(null)
    setHolidayCheck(null)
  }, [statuses])

  function handleClose() {
    reset()
    onClose()
  }

  function addChecklistItem() {
    const t = newChecklistItem.trim()
    if (!t) return
    setChecklist((prev) => [...prev, { title: t }])
    setNewChecklistItem('')
  }

  function removeChecklistItem(idx: number) {
    setChecklist((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleDeadlineDateChange(val: string) {
    // Clearing the date also clears the time. Range is enforced by the DatePicker.
    if (!val) { setDeadlineDate(''); setDeadlineTime(''); return }
    setDeadlineDate(val)
    // Surface the end-of-day default on the clock once a date is picked.
    if (!deadlineTime) setDeadlineTime('23:59')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    if (assignees.filter((a) => !a.is_cc).length === 0) { setError('At least one assignee is required. CC-only tasks are not allowed.'); return }
    if (!deadlineDate) { setError('Deadline is required.'); return }
    if (deadlineDate) {
      if (deadlineDate < todayStr) { setError('Deadline cannot be in the past.'); return }
      if (deadlineDate > '2100-12-31') { setError('Deadline year cannot exceed 2100.'); return }
    }
    setSubmitting(true)
    setError(null)
    try {
      const newTask = await tasksApi.createTask(orgId, {
        title: title.trim(),
        description: description.trim() || undefined,
        // quadrant,
        priority_id: priorityId || undefined,
        category_id: categoryId || undefined,
        status_id: statusId || undefined,
        deadline: deadline || undefined,
        completion_mode: completionMode,
        proof_required: proofRequired,
        assignee_user_ids: assignees.filter((a) => !a.is_cc).map((a) => a.user_id),
        cc_user_ids: assignees.filter((a) => a.is_cc).map((a) => a.user_id),
        checklist_items: checklist.length > 0
          ? checklist.map((item, idx) => ({ title: item.title, order_index: idx }))
          : undefined,
      })
      reset()
      onTaskCreated?.(newTask)
      onCreated()
    } catch {
      setError('Failed to create task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-t-[16px] sm:rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E2E8F0] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="text-[22px] font-semibold text-[#0F172A]">Create Task</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3 text-sm text-[#DC2626]">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              Title <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-base sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
            />
          </div>

          {/* Assignees & CC */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Assignees & CC</label>
            <AssigneeSelector
              orgId={orgId}
              value={assignees}
              onChange={setAssignees}
              currentUser={user ? { user_id: user.id, name: user.name } : undefined}
            />
            <p className="text-[11px] text-[#94A3B8] mt-1">Add people · click their badge to toggle between Assignee and CC</p>
          </div>

          {/* Completion mode — only relevant when multiple assignees are selected */}
          {primaryAssigneeCount > 1 && <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Completion Mode</label>
            <div className="flex gap-3">
              {(['any_can_complete', 'all_must_complete'] as CompletionMode[]).map((mode) => (
                <label
                  key={mode}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="completionMode"
                    value={mode}
                    checked={completionMode === mode}
                    onChange={() => setCompletionMode(mode)}
                    className="accent-[#2563EB]"
                  />
                  <span className="text-sm text-[#1E293B]">
                    {mode === 'any_can_complete' ? 'Any assignee can complete' : 'All assignees must complete'}
                  </span>
                </label>
              ))}
            </div>
          </div>}

          {/* Deadline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#374151]">Deadline <span className="text-[#DC2626]">*</span></label>
              {deadlineDate && (
                <button
                  type="button"
                  onClick={() => { setDeadlineDate(''); setDeadlineTime('') }}
                  className="flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                >
                  <X size={10} />
                  Clear
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {/* Date picker — shared calendar component (opens on click) */}
              <div className="flex-1">
                <DatePicker
                  value={deadlineDate}
                  onChange={handleDeadlineDateChange}
                  min={todayStr}
                  max="2100-12-31"
                  placeholder="Select date"
                />
              </div>

              {/* Time picker — always present, disabled until a date is picked */}
              <div className="flex-1 relative">
                <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  disabled={!deadlineDate}
                  className="w-full border border-[#CBD5E1] rounded-[8px] pl-9 pr-3 py-2.5 text-[15px] text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none transition-colors disabled:bg-[#F1F5F9] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <HolidayWarningBadge check={holidayCheck} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-base sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white resize-none"
            />
          </div>

          {/* Quadrant — hidden */}
          {/* <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Quadrant</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quadrants.map((q) => {
                const cfg = quadrantColors[q.value]
                const isSelected = quadrant === q.value
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setQuadrant(q.value)}
                    className={[
                      'flex flex-col items-center rounded-[8px] px-2 py-2.5 border-2 transition-all duration-150',
                      isSelected
                        ? `${cfg.activeBg} border-transparent text-white`
                        : `${cfg.bg} ${cfg.border} ${cfg.text} hover:opacity-80`,
                    ].join(' ')}
                  >
                    <span className="text-sm font-bold">{q.label}</span>
                    <span className={`text-[10px] leading-tight text-center mt-0.5 ${isSelected ? 'text-white/80' : 'opacity-70'}`}>
                      {q.sublabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div> */}

          {/* Priority + Category + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Priority</label>
              <select
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-base sm:text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              >
                <option value="">No priority</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-base sm:text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Status</label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-base sm:text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Proof required */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProofRequired((v) => !v)}
              className={[
                'relative w-10 h-5 rounded-full transition-colors duration-200',
                proofRequired ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]',
              ].join(' ')}
              role="switch"
              aria-checked={proofRequired}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                  proofRequired ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
            <span className="text-sm text-[#1E293B] font-medium">Proof of completion required</span>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Checklist</label>
            {checklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 rounded border border-[#CBD5E1] shrink-0" />
                <span className="flex-1 text-sm text-[#0F172A]">{item.title}</span>
                <button
                  type="button"
                  onClick={() => removeChecklistItem(idx)}
                  className="text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                placeholder="Add checklist item..."
                className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-base sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="flex items-center gap-1.5 px-3 py-[8px] text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-5 py-[10px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (holidayCheck?.action === 'skip_create' && !holidayCheck.is_working_day)}
            className="w-full sm:w-auto px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
