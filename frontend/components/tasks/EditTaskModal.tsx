'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import TimeField from '@/components/ui/TimeField'
import StyledSelect from '@/components/ui/StyledSelect'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { holidaysApi } from '@/lib/api/holidays'
import type { Task, TaskCategory, TaskPriority, TaskStatus, CompletionMode } from '@/lib/types/tasks'
import type { HolidayCheckResult } from '@/lib/types/holidays'
import HolidayWarningBadge from '@/components/holidays/HolidayWarningBadge'
import LeaveWarningBadge from '@/components/leave/LeaveWarningBadge'
import { leaveApi } from '@/lib/api/leave'
import type { LeaveAvailability } from '@/lib/types/leave'
import { expandLeaveDays, leaveHorizon } from '@/lib/leave-availability'

interface Props {
  task: Task
  categories: TaskCategory[]
  priorities: TaskPriority[]
  statuses: TaskStatus[]
  onClose: () => void
  onSaved: (updated: Task) => void
}

// Format a stored UTC instant in the user's LOCAL date/time for the form inputs.
// (Slicing the raw ISO string would show UTC — wrong for IST users.)
const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalDateStr = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const toLocalTimeStr = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export default function EditTaskModal({ task, categories, priorities, statuses, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priorityId, setPriorityId] = useState(task.priority_id ?? '')
  const [categoryId, setCategoryId] = useState(task.category_id ?? '')
  const [statusId, setStatusId] = useState(task.status_id)
  const [completionMode, setCompletionMode] = useState<CompletionMode>(task.completion_mode ?? 'any_can_complete')
  const [proofRequired, setProofRequired] = useState(task.proof_required ?? false)
  const [deadlineDate, setDeadlineDate] = useState(() => task.deadline ? toLocalDateStr(task.deadline) : '')
  const [deadlineTime, setDeadlineTime] = useState(() => task.deadline ? toLocalTimeStr(task.deadline) : '')
  const todayStr = new Date().toISOString().split('T')[0]
  // Convert the user's local date+time to an ISO instant so the backend stores the
  // exact moment regardless of the server's timezone (EC2 runs UTC, local runs IST).
  const deadline = deadlineDate
    ? new Date(deadlineTime ? `${deadlineDate}T${deadlineTime}` : `${deadlineDate}T23:59`).toISOString()
    : ''

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holidayCheck, setHolidayCheck] = useState<HolidayCheckResult | null>(null)
  const holidayDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leaveAvail, setLeaveAvail] = useState<LeaveAvailability | null>(null)
  // Portal target only exists on the client — guard against SSR mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const primaryAssignees = (task.assignees ?? []).filter((a) => !a.is_cc)
  const assigneeCount = primaryAssignees.length
  const primaryIdsKey = primaryAssignees.map((a) => a.user_id).sort().join(',')

  // Warn if the task's existing assignees are on leave around the (possibly changed) deadline.
  useEffect(() => {
    const ids = primaryIdsKey ? primaryIdsKey.split(',') : []
    if (ids.length === 0 || !orgId) { setLeaveAvail(null); return }
    let cancelled = false
    leaveApi
      .availability(orgId, ids, todayStr, leaveHorizon())
      .then((res) => { if (!cancelled) setLeaveAvail(res) })
      .catch(() => { if (!cancelled) setLeaveAvail(null) })
    return () => { cancelled = true }
  }, [primaryIdsKey, orgId, todayStr])

  const leaveMarkedDays = React.useMemo(
    () => expandLeaveDays(leaveAvail, todayStr, leaveHorizon()),
    [leaveAvail, todayStr],
  )

  useEffect(() => {
    if (holidayDebounceRef.current) clearTimeout(holidayDebounceRef.current)
    if (!deadlineDate || !orgId) { setHolidayCheck(null); return }
    holidayDebounceRef.current = setTimeout(async () => {
      try { setHolidayCheck(await holidaysApi.checkDate(orgId, deadlineDate)) }
      catch { setHolidayCheck(null) }
    }, 300)
    return () => { if (holidayDebounceRef.current) clearTimeout(holidayDebounceRef.current) }
  }, [deadlineDate, orgId])

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
    if (!deadlineDate) { setError('Deadline is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const updated = await tasksApi.updateTask(orgId, task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority_id: priorityId || undefined,
        category_id: categoryId || undefined,
        status_id: statusId || undefined,
        deadline: deadline || undefined,
        completion_mode: completionMode,
        proof_required: proofRequired,
      })
      onSaved(updated)
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-t-[16px] sm:rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E2E8F0] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="text-[22px] font-semibold text-[#0F172A]">Edit Task</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3 text-sm text-[#DC2626]">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Title <span className="text-[#DC2626]">*</span></label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                maxLength={50}
                className="w-full border border-[#CBD5E1] rounded-[8px] pl-3 pr-14 py-[10px] text-base sm:text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] ${title.length >= 50 ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}>
                {title.length}/50
              </span>
            </div>
          </div>

          {/* Completion mode */}
          {assigneeCount > 1 && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Completion Mode</label>
              <div className="flex gap-3">
                {(['any_can_complete', 'all_must_complete'] as CompletionMode[]).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="completionMode" value={mode} checked={completionMode === mode} onChange={() => setCompletionMode(mode)} className="accent-[#2563EB]" />
                    <span className="text-sm text-[#1E293B]">{mode === 'any_can_complete' ? 'Any assignee can complete' : 'All assignees must complete'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Deadline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#374151]">Deadline <span className="text-[#DC2626]">*</span></label>
              {deadlineDate && (
                <button type="button" onClick={() => { setDeadlineDate(''); setDeadlineTime('') }} className="flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#DC2626] transition-colors">
                  <X size={10} /> Clear
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {/* Date picker — shared calendar component (opens on click) */}
              <div className="flex-1">
                <DatePicker
                  value={deadlineDate}
                  onChange={(iso) => {
                    if (!iso) { setDeadlineDate(''); setDeadlineTime(''); return }
                    setDeadlineDate(iso)
                    if (!deadlineTime) setDeadlineTime('23:59')
                  }}
                  min={todayStr}
                  max="2100-12-31"
                  placeholder="Select date"
                  markedDates={leaveMarkedDays}
                  markedHint="An assignee is on leave"
                />
              </div>
              {/* Time picker — always present, disabled until a date is picked */}
              <div className="flex-1">
                <TimeField
                  value={deadlineTime}
                  onChange={setDeadlineTime}
                  disabled={!deadlineDate}
                  label="Deadline time"
                />
              </div>
            </div>
            <HolidayWarningBadge check={holidayCheck} />
            {deadlineDate && <LeaveWarningBadge availability={leaveAvail} deadline={deadlineDate} today={todayStr} />}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                maxLength={2000}
                rows={3}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 pt-[10px] pb-6 text-base sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white resize-none"
              />
              <span className={`pointer-events-none absolute right-3 bottom-2 text-[11px] ${description.length >= 2000 ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}>
                {description.length}/2000
              </span>
            </div>
          </div>

          {/* Priority + Category + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Priority</label>
              <StyledSelect
                value={priorityId}
                onChange={(v) => setPriorityId(v)}
                placeholder="No priority"
                options={[
                  { value: '', label: 'No priority' },
                  ...priorities.map((p) => ({ value: p.id, label: p.label, color: p.color })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Category</label>
              <StyledSelect
                value={categoryId}
                onChange={(v) => setCategoryId(v)}
                placeholder="No category"
                options={[
                  { value: '', label: 'No category' },
                  ...categories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Status</label>
              <StyledSelect
                value={statusId}
                onChange={(v) => setStatusId(v)}
                options={statuses.map((s) => ({ value: s.id, label: s.label, color: s.color }))}
              />
            </div>
          </div>

          {/* Proof required */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProofRequired((v) => !v)}
              className={['relative w-10 h-5 rounded-full transition-colors duration-200', proofRequired ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'].join(' ')}
              role="switch"
              aria-checked={proofRequired}
            >
              <span className={['absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200', proofRequired ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
            </button>
            <span className="text-sm text-[#1E293B] font-medium">Proof of completion required</span>
          </div>
        </form>

        {/* Footer — no Cancel button; the header X / Escape / backdrop close the modal */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
