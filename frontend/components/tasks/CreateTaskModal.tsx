'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X, Plus, Trash2, Calendar, RotateCcw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import TimeField from '@/components/ui/TimeField'
import StyledSelect from '@/components/ui/StyledSelect'
import FileDropzone, { AttachmentErrorBox } from '@/components/ui/FileDropzone'
import { PendingFileList } from '@/components/ui/AttachmentList'
import ScheduleEntryList from '@/components/tasks/ScheduleEntryList'
import type { ScheduleEntryDraft } from '@/components/tasks/ScheduleEntryRow'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { holidaysApi } from '@/lib/api/holidays'
import type { Task, TaskCategory, TaskPriority, TaskStatus, CompletionMode, ChecklistTemplate, RecurringTemplate, ReminderSpec, ReminderRecipient } from '@/lib/types/tasks'
import { TERMINAL_STATUS_PHASES } from '@/lib/types/tasks'
import type { SelectedAssignee } from '@/lib/types/tasks'
import type { HolidayCheckResult } from '@/lib/types/holidays'
// import QuadrantBadge from './QuadrantBadge'
import AssigneeSelector from './AssigneeSelector'
import HolidayWarningBadge from '@/components/holidays/HolidayWarningBadge'
import LeaveWarningBadge from '@/components/leave/LeaveWarningBadge'
import { leaveApi } from '@/lib/api/leave'
import type { LeaveAvailability } from '@/lib/types/leave'
import { expandLeaveDays, leaveHorizon } from '@/lib/leave-availability'

interface ChecklistEntry {
  title: string
}

// A task can carry several checklists at once — e.g. one applied from a template
// plus a fresh custom one. Each group is an independent, editable section.
interface ChecklistGroup {
  key: string // stable local id for React + edits
  title: string // section heading (shown only when 2+ groups exist)
  source: 'template' | 'custom'
  templateId?: string // set when source === 'template' (re-validated server-side)
  items: ChecklistEntry[]
  draft: string // the in-progress "add item" text for this group
}

// One-time = a single task with a fixed deadline. Recurring = a template that
// auto-spawns instances on a schedule (reuses the existing recurring engine).
type TaskMode = 'one_time' | 'recurring'

// A reminder being edited in the form. The assignee is always notified; the
// assigner / CC toggles add extra recipients.
interface ReminderRow {
  key: string
  kind: 'relative' | 'absolute'
  offsetDays: number // relative: days before deadline
  date: string // absolute: yyyy-mm-dd
  time: string // HH:mm — fire time (relative) / time on the date (absolute)
  toAssigner: boolean
  toCc: boolean
}

function defaultScheduleEntry(): ScheduleEntryDraft {
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
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  // One-time vs recurring. One-time is the default.
  const [mode, setMode] = useState<TaskMode>('one_time')
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryDraft[]>([defaultScheduleEntry()])
  // Set once a recurring template is created — drives the success confirmation.
  const [createdRecurring, setCreatedRecurring] = useState<RecurringTemplate | null>(null)

  // A brand-new task can't start in a terminal state — hide completed/incomplete
  // from the picker (and from default selection).
  const selectableStatuses = statuses.filter((s) => !TERMINAL_STATUS_PHASES.includes(s.type))

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
  // Reminders can only be set once their timing is anchored: a deadline (one-time) or
  // a schedule (recurring). Until then the section is gated.
  const remindersAvailable = mode === 'recurring' || !!deadlineDate
  const [completionMode, setCompletionMode] = useState<CompletionMode>('any_can_complete')
  const [proofRequired, setProofRequired] = useState(false)
  const [assignees, setAssignees] = useState<SelectedAssignee[]>([])
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [attachErrors, setAttachErrors] = useState<string[]>([])
  // Attachments are collapsed by default to save space — expand via the + button.
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  // Checklist is likewise collapsed by default — expand via the + button.
  const [checklistOpen, setChecklistOpen] = useState(false)
  // Reminders collapse to a read-only summary until expanded for editing.
  const [remindersOpen, setRemindersOpen] = useState(false)
  // Inline gate message shown under the Reminders card (one-time needs a deadline first).
  const [reminderGate, setReminderGate] = useState<string | null>(null)
  const [checklistGroups, setChecklistGroups] = useState<ChecklistGroup[]>([])
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([])
  const groupSeq = useRef(0)
  const nextGroupKey = () => `g${(groupSeq.current += 1)}`
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holidayCheck, setHolidayCheck] = useState<HolidayCheckResult | null>(null)
  const holidayDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leaveAvail, setLeaveAvail] = useState<LeaveAvailability | null>(null)
  // Reminders — one seeded from the admin default on open, all editable/removable.
  const [reminders, setReminders] = useState<ReminderRow[]>([])
  const reminderSeq = useRef(0)
  const makeReminderRow = useCallback((partial?: Partial<ReminderRow>): ReminderRow => ({
    key: `r${(reminderSeq.current += 1)}`,
    kind: 'relative',
    offsetDays: 1,
    date: '',
    time: '09:00',
    toAssigner: false,
    toCc: false,
    ...partial,
  }), [])

  // Portal target only exists on the client — guard against SSR mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Load the checklist templates this user is allowed to apply, when the modal opens.
  useEffect(() => {
    if (!isOpen || !orgId) return
    tasksApi.getAccessibleChecklistTemplates(orgId).then(setChecklistTemplates).catch(() => setChecklistTemplates([]))
  }, [isOpen, orgId])

  // The gate clears itself once reminders become available (deadline set / recurring).
  useEffect(() => {
    if (deadlineDate || mode === 'recurring') setReminderGate(null)
  }, [deadlineDate, mode])

  // On open, seed a single reminder from the admin default (removable).
  useEffect(() => {
    if (!isOpen || !orgId) return
    tasksApi.getConfig(orgId)
      .then((cfg) => setReminders([makeReminderRow({ offsetDays: cfg?.default_reminder_days_before ?? 1 })]))
      .catch(() => setReminders([makeReminderRow({ offsetDays: 1 })]))
  }, [isOpen, orgId, makeReminderRow])

  // Add a checklist sourced from a template — its items are copied in and stay
  // fully editable. Applying a template never wipes other checklists; it adds one.
  function addTemplateGroup(templateId: string) {
    if (!templateId) return
    const tpl = checklistTemplates.find((t) => t.id === templateId)
    if (!tpl) return
    const sorted = [...(tpl.items ?? [])].sort((a, b) => a.order_index - b.order_index)
    setChecklistGroups((prev) => [
      ...prev,
      {
        key: nextGroupKey(),
        title: tpl.name,
        source: 'template',
        templateId: tpl.id,
        items: sorted.map((i) => ({ title: i.title })),
        draft: '',
      },
    ])
  }

  // Add an empty checklist the user fills in themselves.
  function addBlankGroup() {
    setChecklistGroups((prev) => [
      ...prev,
      {
        key: nextGroupKey(),
        title: prev.length === 0 ? 'Checklist' : `Checklist ${prev.length + 1}`,
        source: 'custom',
        items: [],
        draft: '',
      },
    ])
  }

  function removeGroup(key: string) {
    setChecklistGroups((prev) => prev.filter((g) => g.key !== key))
  }

  function updateGroupTitle(key: string, title: string) {
    setChecklistGroups((prev) => prev.map((g) => (g.key === key ? { ...g, title } : g)))
  }

  function updateGroupDraft(key: string, draft: string) {
    setChecklistGroups((prev) => prev.map((g) => (g.key === key ? { ...g, draft } : g)))
  }

  function addItemToGroup(key: string) {
    setChecklistGroups((prev) =>
      prev.map((g) => {
        if (g.key !== key) return g
        const t = g.draft.trim()
        if (!t) return g
        return { ...g, items: [...g.items, { title: t }], draft: '' }
      }),
    )
  }

  function removeItemFromGroup(key: string, idx: number) {
    setChecklistGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, items: g.items.filter((_, i) => i !== idx) } : g)),
    )
  }

  const primaryAssignees = assignees.filter((a) => !a.is_cc)
  const primaryAssigneeCount = primaryAssignees.length
  const primaryIdsKey = primaryAssignees.map((a) => a.user_id).sort().join(',')

  // Fetch leave windows for the selected (primary) assignees over a bounded horizon.
  // Drives both the deadline warning and the date-picker dots. Non-blocking.
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
    if (primaryAssigneeCount <= 1) setCompletionMode('any_can_complete')
  }, [primaryAssigneeCount])

  // New tasks always start in the "Not Started" phase (the org's birth status).
  useEffect(() => {
    if (selectableStatuses.length > 0 && !statusId) {
      const def =
        selectableStatuses.find((s) => s.type === 'not_started') ??
        selectableStatuses.find((s) => s.is_default) ??
        selectableStatuses[0]
      setStatusId(def.id)
    }
  }, [selectableStatuses, statusId])

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
    setStatusId(
      selectableStatuses.find((s) => s.type === 'not_started')?.id ??
        selectableStatuses.find((s) => s.is_default)?.id ??
        selectableStatuses[0]?.id ??
        '',
    )
    setDeadlineDate('')
    setDeadlineTime('')
    setMode('one_time')
    setScheduleEntries([defaultScheduleEntry()])
    setCreatedRecurring(null)
    setCompletionMode('any_can_complete')
    setProofRequired(false)
    setAssignees([])
    setAttachmentFiles([])
    setAttachmentsOpen(false)
    setChecklistOpen(false)
    setRemindersOpen(false)
    setReminderGate(null)
    setChecklistGroups([])
    setReminders([])
    setError(null)
    setHolidayCheck(null)
  }, [selectableStatuses])

  function handleClose() {
    reset()
    onClose()
  }

  function handleDeadlineDateChange(val: string) {
    // Clearing the date also clears the time. Range is enforced by the DatePicker.
    if (!val) { setDeadlineDate(''); setDeadlineTime(''); setRemindersOpen(false); return }
    setDeadlineDate(val)
    // Surface the end-of-day default on the clock once a date is picked.
    if (!deadlineTime) setDeadlineTime('23:59')
  }

  // Flatten every checklist group into one ordered list. A group is labelled
  // (keeps its heading) when there are 2+ groups OR when it came from a template
  // — so a single applied template still shows its name. A lone blank checklist
  // stays unlabelled and renders as a plain list. Shared by both create paths.
  function buildChecklistItems(): { title: string; order_index: number; group_title?: string }[] | undefined {
    const groups = checklistGroups.filter((g) => g.items.length > 0)
    if (groups.length === 0) return undefined
    const multiple = groups.length >= 2
    let order = 0
    return groups.flatMap((g) => {
      const labelled = multiple || g.source === 'template'
      return g.items.map((item) => ({
        title: item.title,
        order_index: order++,
        group_title: labelled ? g.title.trim() || 'Checklist' : undefined,
      }))
    })
  }

  function updateReminder(key: string, patch: Partial<ReminderRow>) {
    setReminders((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function removeReminder(key: string) {
    setReminders((prev) => prev.filter((r) => r.key !== key))
  }
  function addReminder() {
    setReminders((prev) => [...prev, makeReminderRow()])
  }

  // Short read-only label for a reminder, shown in the collapsed summary.
  function reminderLabel(r: ReminderRow): string {
    const extra = [r.toAssigner && 'assigner', r.toCc && 'CC'].filter(Boolean).join(' + ')
    const who = extra ? ` → +${extra}` : ''
    if (r.kind === 'relative') {
      const d = r.offsetDays === 0 ? 'On the day' : `${r.offsetDays} day${r.offsetDays !== 1 ? 's' : ''} before`
      return `${d} · ${r.time || '09:00'}${who}`
    }
    const date = r.date ? new Date(`${r.date}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'no date'
    return `On ${date} · ${r.time || '09:00'}${who}`
  }

  // Convert the reminder rows into ReminderSpecs for the API. For one-time tasks
  // (resolveRelative), relative reminders are precomputed to an absolute instant in
  // the user's local timezone; for recurring templates they stay relative so each
  // spawned instance recomputes against its own deadline.
  function buildReminderSpecs(resolveRelative: boolean): ReminderSpec[] {
    return reminders.flatMap((r) => {
      const recipients: ReminderRecipient[] = [
        'assignee',
        ...(r.toAssigner ? (['assigner'] as const) : []),
        ...(r.toCc ? (['cc'] as const) : []),
      ]
      if (r.kind === 'relative') {
        const spec: ReminderSpec = { kind: 'relative', offset_days: r.offsetDays, time: r.time || '09:00', recipients }
        if (resolveRelative && deadlineDate) {
          const d = new Date(`${deadlineDate}T${r.time || '09:00'}`)
          d.setDate(d.getDate() - r.offsetDays)
          spec.remind_at = d.toISOString()
        }
        return [spec]
      }
      if (!r.date) return []
      return [{ kind: 'absolute', remind_at: new Date(`${r.date}T${r.time || '09:00'}`).toISOString(), recipients }]
    })
  }

  // The absolute moment a reminder would fire (given the current one-time deadline).
  function reminderInstant(r: ReminderRow): Date | null {
    if (r.kind === 'relative') {
      if (!deadlineDate) return null
      const d = new Date(`${deadlineDate}T${r.time || '09:00'}`)
      d.setDate(d.getDate() - r.offsetDays)
      return d
    }
    return r.date ? new Date(`${r.date}T${r.time || '09:00'}`) : null
  }

  // Reminders must fall between now (task creation) and the deadline. One-time mode
  // only — recurring recomputes per instance. Returns an error string, or null if valid.
  function validateRemindersAgainstDeadline(): string | null {
    if (reminders.some((r) => r.kind === 'absolute' && !r.date)) return 'Pick a date for each “on a date” reminder.'
    const now = new Date()
    const deadlineInstant = deadline ? new Date(deadline) : null
    for (const r of reminders) {
      const at = reminderInstant(r)
      if (!at) continue
      if (at.getTime() <= now.getTime()) return `A reminder (${reminderLabel(r)}) falls in the past. Reminders must be after now.`
      if (deadlineInstant && at.getTime() > deadlineInstant.getTime()) {
        return `A reminder (${reminderLabel(r)}) is after the deadline. Reminders must be on or before the due date.`
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'recurring') { await handleCreateRecurring(); return }
    if (!title.trim()) { setError('Title is required.'); return }
    if (assignees.filter((a) => !a.is_cc).length === 0) { setError('At least one assignee is required. CC-only tasks are not allowed.'); return }
    if (!deadlineDate) { setError('Deadline is required.'); return }
    if (deadlineDate) {
      if (deadlineDate < todayStr) { setError('Deadline cannot be in the past.'); return }
      if (deadlineDate > '2100-12-31') { setError('Deadline year cannot exceed 2100.'); return }
    }
    const reminderError = validateRemindersAgainstDeadline()
    if (reminderError) { setError(reminderError); return }
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
        checklist_items: buildChecklistItems(),
        checklist_template_ids: Array.from(
          new Set(checklistGroups.filter((g) => g.templateId).map((g) => g.templateId as string)),
        ),
        reminders: buildReminderSpecs(true),
      })
      // Upload any attached documents to the freshly-created task. Files upload
      // sequentially so a partial failure is easy to surface without losing the task.
      if (attachmentFiles.length > 0) {
        try {
          for (const file of attachmentFiles) {
            await tasksApi.uploadTaskAttachment(orgId, newTask.id, file)
          }
        } catch {
          // The task exists — only the upload failed. Keep the modal open so the user
          // sees why; the task will still appear in the list once they close it.
          setError('Task created, but an attachment failed to upload. Open the task to add it again.')
          onTaskCreated?.(newTask)
          onCreated()
          return
        }
      }
      reset()
      onTaskCreated?.(newTask)
      onCreated()
    } catch {
      setError('Failed to create task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Recurring path — creates a template (reusing the existing recurring engine),
  // uploads its attachments (which the scheduler copies into every spawned
  // instance), then shows a confirmation pointing to the Recurring tab.
  async function handleCreateRecurring() {
    if (!title.trim()) { setError('Title is required.'); return }
    if (assignees.filter((a) => !a.is_cc).length === 0) { setError('At least one assignee is required. CC-only tasks are not allowed.'); return }
    for (const entry of scheduleEntries) {
      if (entry.schedule_type === 'weekly' && entry.days.length === 0) {
        setError('Select at least one day of the week for each weekly schedule.'); return
      }
      if (entry.schedule_type === 'monthly' && entry.month_days.length === 0) {
        setError('Select at least one day of the month for each monthly schedule.'); return
      }
      if (entry.schedule_type === 'yearly' && entry.yearly_dates.length === 0) {
        setError('Select at least one date for each yearly schedule.'); return
      }
      if (entry.end_condition === 'on_date' && !entry.end_date) {
        setError('End date is required for schedules ending "On date".'); return
      }
    }
    if (reminders.some((r) => r.kind === 'absolute' && !r.date)) { setError('Pick a date for each “on a date” reminder.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const template = await tasksApi.createRecurring(orgId, {
        title: title.trim(),
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
        priority_id: priorityId || undefined,
        schedule_entries: scheduleEntries.map((en, idx) => ({
          schedule_type: en.schedule_type,
          every: en.every,
          days: en.days,
          month_days: en.month_days,
          yearly_dates: en.yearly_dates,
          time: en.time,
          start_date: en.start_date,
          end_condition: en.end_condition,
          end_date: en.end_condition === 'on_date' ? en.end_date : undefined,
          end_after: en.end_condition === 'after_n' ? en.end_after : undefined,
          order_index: idx,
        })),
        completion_mode: completionMode,
        proof_required: proofRequired,
        assignee_user_ids: assignees.filter((a) => !a.is_cc).map((a) => a.user_id),
        cc_user_ids: assignees.filter((a) => a.is_cc).map((a) => a.user_id),
        checklist_items: buildChecklistItems(),
        reminders: buildReminderSpecs(false),
      })
      // Upload the template's attachments — copied into every spawned instance.
      if (attachmentFiles.length > 0) {
        try {
          for (const file of attachmentFiles) {
            await tasksApi.uploadRecurringAttachment(orgId, template.id, file)
          }
        } catch {
          setError('Recurring task created, but an attachment failed to upload. Open it in the Recurring tab to add it again.')
          setCreatedRecurring(template)
          return
        }
      }
      setCreatedRecurring(template)
    } catch {
      setError('Failed to create recurring task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

  // ── Success confirmation (recurring only) ───────────────────────────────────
  if (createdRecurring) {
    return createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative w-full max-w-md bg-white rounded-t-[16px] sm:rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E2E8F0] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-[#16A34A]" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#0F172A]">Recurring task created</h2>
            <p className="text-sm text-[#475569] mt-2">
              <span className="font-medium text-[#0F172A]">“{createdRecurring.title}”</span> now lives in the{' '}
              <span className="font-medium text-[#2563EB]">Recurring</span> tab under Work. New task instances will be
              created automatically on schedule — with these attachments included each time.
            </p>
            {error && (
              <div className="w-full mt-4 bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3 text-sm text-[#DC2626]">
                {error}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full mt-6">
              <button
                type="button"
                onClick={() => { onCreated(); handleClose() }}
                className="w-full sm:flex-1 px-5 py-[10px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => { onCreated(); handleClose(); router.push('/dashboard/tasks/recurring') }}
                className="w-full sm:flex-1 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"
              >
                Go to Recurring
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[#374151]">
                Title <span className="text-[#DC2626]">*</span>
              </label>
              <span className={`text-[11px] ${title.length >= 50 ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}>
                {title.length}/50
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              maxLength={50}
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
            <p className="text-[11px] text-[#475569] mt-1">Add people · click their badge to toggle between Assignee and CC</p>
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

          {/* Schedule mode — one-time (single deadline) vs recurring (auto-spawns) */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Schedule</label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-[#F1F5F9] border border-[#E2E8F0]">
              {([
                { value: 'one_time' as TaskMode, label: 'One-time', icon: Calendar },
                { value: 'recurring' as TaskMode, label: 'Recurring', icon: RotateCcw },
              ]).map((opt) => {
                const active = mode === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setMode(opt.value); setError(null) }}
                    className={[
                      'flex items-center justify-center gap-2 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors',
                      active ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#475569] hover:bg-white',
                    ].join(' ')}
                    aria-pressed={active}
                  >
                    <Icon size={15} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-[#475569] mt-1.5">
              {mode === 'one_time'
                ? 'A single task with a fixed deadline.'
                : 'Auto-creates task instances on a schedule. Managed in the Recurring tab; attachments repeat on every instance.'}
            </p>
          </div>

          {mode === 'one_time' ? (
          /* Deadline */
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#374151]">Deadline <span className="text-[#DC2626]">*</span></label>
              {deadlineDate && (
                <button
                  type="button"
                  onClick={() => { setDeadlineDate(''); setDeadlineTime(''); setRemindersOpen(false) }}
                  className="flex items-center gap-1 text-[11px] text-[#475569] hover:text-[#DC2626] transition-colors"
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
          ) : (
          /* Recurring schedule — reuses the recurring engine's schedule builder */
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">
              Recurrence <span className="text-[#DC2626]">*</span>
            </label>
            <ScheduleEntryList entries={scheduleEntries} onChange={setScheduleEntries} />
          </div>
          )}

          {/* Reminders — notify the assignee (and optionally the assigner / CC)
              before the deadline. Multiple entries; on a recurring task they apply
              to every spawned instance. */}
          <div>
            <div className="rounded-[12px] border border-[#E2E8F0] bg-white overflow-visible">
              {/* Header — click to expand/collapse; collapsed shows a read-only summary */}
              <button
                type="button"
                onClick={() => {
                  // In one-time mode reminders are relative to the deadline, so it must
                  // be set first. Recurring recomputes per instance, so it's allowed.
                  if (!remindersAvailable) {
                    setReminderGate('Please select a deadline first, then set reminders.')
                    return
                  }
                  setReminderGate(null)
                  setRemindersOpen((v) => !v)
                }}
                aria-expanded={remindersOpen}
                className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-[#F8FAFC] transition-colors"
              >
                <label className="text-sm font-medium text-[#374151] cursor-pointer shrink-0">Reminders</label>
                <span className="text-xs font-normal text-[#475569] shrink-0">Optional</span>
                {remindersAvailable && reminders.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold shrink-0">
                    {reminders.length}
                  </span>
                )}
                {!remindersOpen && remindersAvailable && (
                  <span className="min-w-0 flex-1 truncate text-xs text-[#475569]">
                    {reminders.length === 0
                      ? 'None'
                      : reminders.length === 1
                        ? reminderLabel(reminders[0])
                        : `${reminderLabel(reminders[0])}  ·  +${reminders.length - 1} more`}
                  </span>
                )}
                <span className="ml-auto flex items-center justify-center w-6 h-6 rounded-[6px] text-[#2563EB] shrink-0" aria-hidden>
                  {remindersAvailable && reminders.length > 0 ? (
                    // Has data → collapse/expand affordance
                    remindersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                  ) : (
                    // Empty / not yet available → plus to add, rotating to a cross when open
                    <Plus size={18} className={remindersOpen ? 'rotate-45 transition-transform' : 'transition-transform'} />
                  )}
                </span>
              </button>
              {remindersOpen && (
              <div className="px-3 pb-3 pt-0 space-y-2 max-h-[340px] overflow-y-auto">
                {reminders.length === 0 ? (
                  <p className="text-xs text-[#475569] px-1 py-2">No reminders — the assignee won’t be nudged before the deadline.</p>
                ) : (
                  reminders.map((r) => {
                    let hint: string | null = null
                    if (r.kind === 'relative' && mode === 'one_time' && deadlineDate) {
                      const d = new Date(`${deadlineDate}T00:00`)
                      d.setDate(d.getDate() - r.offsetDays)
                      hint = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                    }
                    return (
                      <div key={r.key} className="relative rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2.5">
                        {/* remove — top-right corner */}
                        <button
                          type="button"
                          onClick={() => removeReminder(r.key)}
                          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-white transition-colors"
                          aria-label="Remove reminder"
                        >
                          <X size={14} />
                        </button>

                        {/* kind toggle — full width, with room reserved for the corner X */}
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-[8px] bg-[#F1F5F9] border border-[#E2E8F0] mr-7">
                          {([
                            { k: 'relative' as const, label: 'Days before' },
                            { k: 'absolute' as const, label: 'On a date' },
                          ]).map(({ k, label }) => {
                            const active = r.kind === k
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => updateReminder(r.key, { kind: k })}
                                className={[
                                  'px-2 py-1.5 rounded-[6px] text-xs font-medium transition-colors',
                                  active ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:bg-white',
                                ].join(' ')}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>

                        {/* timing + recipients on one line (wraps only when too narrow) */}
                        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                          {r.kind === 'relative' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={r.offsetDays}
                                onChange={(e) => updateReminder(r.key, { offsetDays: Math.max(0, parseInt(e.target.value) || 0) })}
                                className="w-11 text-center border border-[#CBD5E1] rounded-[8px] px-2 py-1.5 text-[13px] text-[#0F172A] bg-[#F8FAFC] hover:bg-white hover:border-[#94A3B8] focus:bg-white focus:border-2 focus:border-[#2563EB] focus:outline-none"
                              />
                              <span className="text-[13px] text-[#475569]">days before</span>
                              <div className="w-[104px]">
                                <TimeField value={r.time} onChange={(v) => updateReminder(r.key, { time: v })} label="Reminder time" compact />
                              </div>
                              {hint && <span className="text-xs font-medium text-[#2563EB]">→ {hint}</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-[140px]">
                                <DatePicker
                                  value={r.date}
                                  onChange={(v) => updateReminder(r.key, { date: v })}
                                  min={todayStr}
                                  max={mode === 'one_time' && deadlineDate ? deadlineDate : '2100-12-31'}
                                  placeholder="Pick date"
                                  compact
                                />
                              </div>
                              <div className="w-[104px]">
                                <TimeField value={r.time} onChange={(v) => updateReminder(r.key, { time: v })} label="Reminder time" compact />
                              </div>
                            </div>
                          )}

                          {/* recipients — sit at the right of the same row, wrap under if tight */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-xs text-[#475569]">Notify:</span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#2563EB] text-white">Assignee</span>
                            <button
                              type="button"
                              onClick={() => updateReminder(r.key, { toAssigner: !r.toAssigner })}
                              className={[
                                'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                                r.toAssigner ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#94A3B8]',
                              ].join(' ')}
                            >
                              Assigner
                            </button>
                            <button
                              type="button"
                              onClick={() => updateReminder(r.key, { toCc: !r.toCc })}
                              className={[
                                'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                                r.toCc ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#94A3B8]',
                              ].join(' ')}
                            >
                              CC
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <button
                  type="button"
                  onClick={addReminder}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
                >
                  <Plus size={14} /> Add reminder
                </button>
              </div>
              )}
            </div>
            {reminderGate && <p className="mt-1.5 text-xs text-[#DC2626]">{reminderGate}</p>}
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

          {/* Priority + Category — every new task starts in "Not Started", so status
              is not shown here (set automatically). */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Priority</label>
              <StyledSelect
                value={priorityId}
                onChange={setPriorityId}
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
                onChange={setCategoryId}
                placeholder="No category"
                options={[
                  { value: '', label: 'No category' },
                  ...categories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
                ]}
              />
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

          {/* Attachments — collapsed by default to save space; the + button in the
              header expands the full dropzone. Applies to both one-time and recurring
              (a recurring template's attachments repeat on every spawned instance). */}
          <div>
            <div className="rounded-[12px] border border-[#E2E8F0] bg-white overflow-hidden">
              {/* Card header — click anywhere to toggle; + button on the right */}
              <button
                type="button"
                onClick={() => setAttachmentsOpen((v) => !v)}
                aria-expanded={attachmentsOpen}
                className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-[#F8FAFC] transition-colors"
              >
                <label className="text-sm font-medium text-[#374151] cursor-pointer">Attachments</label>
                <span className="text-xs font-normal text-[#475569]">Optional</span>
                {attachmentFiles.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold">
                    {attachmentFiles.length}
                  </span>
                )}
                <span
                  className={[
                    'ml-auto flex items-center justify-center w-6 h-6 rounded-[6px] text-[#2563EB] transition-transform',
                    attachmentsOpen ? 'rotate-45' : '',
                  ].join(' ')}
                  aria-hidden
                >
                  <Plus size={18} />
                </span>
              </button>
              {/* Body — fixed dropzone button on top; errors + pending files
                  share ONE scroll region below so the error box scrolls away
                  with the list instead of staying pinned. */}
              {attachmentsOpen && (
                <div className="px-3 pb-3 pt-0">
                  <FileDropzone
                    onFiles={(fs) => setAttachmentFiles((prev) => [...prev, ...fs])}
                    onReject={setAttachErrors}
                    disabled={submitting}
                  />
                  {(attachErrors.length > 0 || attachmentFiles.length > 0) && (
                    <div className="max-h-[220px] overflow-y-auto mt-2 space-y-2">
                      {attachErrors.length > 0 && (
                        <AttachmentErrorBox errors={attachErrors} onDismiss={() => setAttachErrors([])} />
                      )}
                      {attachmentFiles.length > 0 && (
                        <PendingFileList
                          files={attachmentFiles}
                          uploading={submitting && attachmentFiles.length > 0}
                          onRemove={(idx) => setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Checklist — collapsed by default to save space; the + button in the header
              expands it. Optional, and you can attach more than one. On a recurring task
              these repeat on every spawned instance. overflow-visible so the template
              dropdown can open upward past the card. */}
          <div>
            <div className="rounded-[12px] border border-[#E2E8F0] bg-white overflow-visible">
              {/* Card header — click anywhere to toggle; + button on the right */}
              <button
                type="button"
                onClick={() => setChecklistOpen((v) => !v)}
                aria-expanded={checklistOpen}
                className="w-full flex items-center gap-2 px-3 py-3 text-left rounded-t-[12px] hover:bg-[#F8FAFC] transition-colors"
              >
                <label className="text-sm font-medium text-[#374151] cursor-pointer">Checklist</label>
                <span className="text-xs font-normal text-[#475569]">Optional</span>
                {checklistGroups.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold">
                    {checklistGroups.length}
                  </span>
                )}
                <span
                  className={[
                    'ml-auto flex items-center justify-center w-6 h-6 rounded-[6px] text-[#2563EB] transition-transform',
                    checklistOpen ? 'rotate-45' : '',
                  ].join(' ')}
                  aria-hidden
                >
                  <Plus size={18} />
                </span>
              </button>

            {!checklistOpen ? null : checklistGroups.length === 0 ? (
              <>
                {/* Body — explain the choice, then the two ways to add one */}
                <div className="px-4 pb-4 pt-0">
                  <p className="text-xs text-[#475569] mb-3">
                    Apply a template, build your own, or combine both. You can add several checklists to one task.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {checklistTemplates.length > 0 && (
                      <StyledSelect
                        value=""
                        onChange={addTemplateGroup}
                        placeholder="Apply a template…"
                        wrapperClassName="sm:flex-1"
                        options={checklistTemplates.map((t) => ({ value: t.id, label: t.name }))}
                      />
                    )}
                    <button
                      type="button"
                      onClick={addBlankGroup}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors whitespace-nowrap"
                    >
                      <Plus size={14} />
                      Blank checklist
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Scrollable body — multiple checklists live here and scroll internally
                    so the card never stretches the modal, no matter how many you add. */}
                <div className="max-h-[300px] overflow-y-auto p-3 space-y-3">
                {checklistGroups.map((g) => {
                  const multi = checklistGroups.length >= 2
                  return (
                    <div key={g.key} className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                      {/* Group header: editable name (only meaningful with 2+ groups) + template tag + remove */}
                      <div className="flex items-center gap-2 mb-2">
                        {multi ? (
                          <input
                            type="text"
                            value={g.title}
                            onChange={(e) => updateGroupTitle(g.key, e.target.value)}
                            placeholder="Checklist name"
                            className="flex-1 min-w-0 border-b border-transparent hover:border-[#E2E8F0] focus:border-[#2563EB] px-0.5 py-0.5 text-sm font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none bg-transparent"
                          />
                        ) : (
                          <span className="flex-1 text-sm font-semibold text-[#0F172A]">{g.title.trim() || 'Checklist'}</span>
                        )}
                        {g.source === 'template' && (
                          <span className="shrink-0 text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-2 py-0.5">
                            Template
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeGroup(g.key)}
                          className="shrink-0 text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                          aria-label="Remove checklist"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Items */}
                      {g.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-1.5">
                          <div className="w-4 h-4 rounded border border-[#CBD5E1] shrink-0" />
                          <span className="flex-1 text-sm text-[#0F172A]">{item.title}</span>
                          <button
                            type="button"
                            onClick={() => removeItemFromGroup(g.key, idx)}
                            className="text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {/* Add item to this group */}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={g.draft}
                          onChange={(e) => updateGroupDraft(g.key, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItemToGroup(g.key) } }}
                          placeholder="Add an item…"
                          className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-base sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => addItemToGroup(g.key)}
                          className="flex items-center gap-1.5 px-3 py-[8px] text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>
                    </div>
                  )
                })}
                </div>

                {/* Sticky footer — stays put while the checklists above scroll */}
                <div className="flex flex-col sm:flex-row gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] p-3">
                  {checklistTemplates.length > 0 && (
                    <StyledSelect
                      value=""
                      onChange={addTemplateGroup}
                      placeholder="Add from a template…"
                      wrapperClassName="sm:flex-1"
                      options={checklistTemplates.map((t) => ({ value: t.id, label: t.name }))}
                    />
                  )}
                  <button
                    type="button"
                    onClick={addBlankGroup}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] bg-white hover:bg-[#EFF6FF] transition-colors whitespace-nowrap"
                  >
                    <Plus size={14} />
                    Add checklist
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </form>

        {/* Footer — no Cancel button; the header X closes the modal (see DESIGN_RULES) */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (mode === 'one_time' && holidayCheck?.action === 'skip_create' && !holidayCheck.is_working_day)}
            className="w-full sm:w-auto px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : mode === 'recurring' ? 'Create Recurring Task' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
