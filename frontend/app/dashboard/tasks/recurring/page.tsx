'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type {
  RecurringTemplate,
  TaskCategory,
  TaskPriority,
  TaskQuadrant,
  CompletionMode,
} from '@/lib/types/tasks'
import type { SelectedAssignee } from '@/lib/types/tasks'
import QuadrantBadge from '@/components/tasks/QuadrantBadge'
import AssigneeSelector from '@/components/tasks/AssigneeSelector'
import {
  RotateCcw, Play, Pause, Calendar, Users, Plus, X, Trash2,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const avatarColors = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]',
  'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]',
]
function avatarColor(str: string): string {
  let h = 0; for (let i = 0; i < str.length; i++) h += str.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}

function scheduleLabel(t: RecurringTemplate): string {
  if (t.schedule_type === 'daily') return `Every ${t.every > 1 ? `${t.every} days` : 'day'}`
  if (t.schedule_type === 'weekly') {
    const days = (t.days ?? []).map((d) => DOW[d]).join(', ')
    return `Every ${t.every > 1 ? `${t.every} weeks` : 'week'}${days ? ` on ${days}` : ''}`
  }
  if (t.schedule_type === 'monthly') return `Day ${t.month_day ?? '?'} every ${t.every > 1 ? `${t.every} months` : 'month'}`
  if (t.schedule_type === 'yearly') return `${MONTHS_FULL[(t.month ?? 1) - 1]} ${t.month_day ?? '?'} each year`
  return t.schedule_type
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const quadrants: { value: TaskQuadrant; label: string; sublabel: string }[] = [
  { value: 'Q1', label: 'Q1', sublabel: 'Urgent + Important' },
  { value: 'Q2', label: 'Q2', sublabel: 'Not Urgent + Important' },
  { value: 'Q3', label: 'Q3', sublabel: 'Urgent + Not Important' },
  { value: 'Q4', label: 'Q4', sublabel: 'Not Urgent + Not Important' },
]
const quadrantColors: Record<TaskQuadrant, { bg: string; text: string; border: string; activeBg: string }> = {
  Q1: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]', activeBg: 'bg-[#DC2626]' },
  Q2: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]', activeBg: 'bg-[#2563EB]' },
  Q3: { bg: 'bg-[#FEF9C3]', text: 'text-[#D97706]', border: 'border-[#FDE68A]', activeBg: 'bg-[#D97706]' },
  Q4: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', border: 'border-[#E5E7EB]', activeBg: 'bg-[#6B7280]' },
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
  // Basic
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quadrant, setQuadrant] = useState<TaskQuadrant>('Q2')
  const [priorityId, setPriorityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [completionMode, setCompletionMode] = useState<CompletionMode>('any_can_complete')
  const [proofRequired, setProofRequired] = useState(false)
  const [assignees, setAssignees] = useState<SelectedAssignee[]>([])

  // Schedule
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
  const [every, setEvery] = useState(1)
  const [days, setDays] = useState<number[]>([])
  const [monthDay, setMonthDay] = useState(1)
  const [month, setMonth] = useState(1)
  const [time, setTime] = useState('09:00')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  // End condition
  const [endCondition, setEndCondition] = useState<'never' | 'on_date' | 'after_n'>('never')
  const [endDate, setEndDate] = useState('')
  const [endAfter, setEndAfter] = useState(10)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape key
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    if (scheduleType === 'weekly' && days.length === 0) { setError('Select at least one day of the week.'); return }
    if (endCondition === 'on_date' && !endDate) { setError('End date is required.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const result = await tasksApi.createRecurring(orgId, {
        title: title.trim(),
        description: description.trim() || undefined,
        quadrant,
        category_id: categoryId || undefined,
        priority_id: priorityId || undefined,
        schedule_type: scheduleType,
        every,
        days: scheduleType === 'weekly' ? days : [],
        month_day: (scheduleType === 'monthly' || scheduleType === 'yearly') ? monthDay : undefined,
        month: scheduleType === 'yearly' ? month : undefined,
        time,
        start_date: startDate,
        end_condition: endCondition,
        end_date: endCondition === 'on_date' ? endDate : undefined,
        end_after: endCondition === 'after_n' ? endAfter : undefined,
        completion_mode: completionMode,
        proof_required: proofRequired,
        assignee_user_ids: assignees.filter((a) => !a.is_cc).map((a) => a.user_id),
        cc_user_ids: assignees.filter((a) => a.is_cc).map((a) => a.user_id),
        is_active: true,
        occurrence_count: 0,
      } as any)
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

          {/* ── Basic info ─────────────────────────────────────────────────── */}
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

            {/* Quadrant */}
            <div>
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
                        'flex flex-col items-center rounded-[8px] px-2 py-2.5 border-2 transition-all',
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

          {/* ── Schedule ───────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Schedule</p>

            {/* Schedule type tabs */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">Repeat</label>
              <div className="flex items-center border border-[#E2E8F0] rounded-[8px] p-0.5 gap-0.5">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScheduleType(s)}
                    className={[
                      'flex-1 py-1.5 text-sm font-medium rounded-[6px] transition-colors capitalize',
                      scheduleType === s ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:bg-[#F1F5F9]',
                    ].join(' ')}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Every N */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#374151] font-medium shrink-0">Every</span>
              <input
                type="number"
                min={1}
                max={365}
                value={every}
                onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white text-center"
              />
              <span className="text-sm text-[#475569]">
                {scheduleType === 'daily' ? (every === 1 ? 'day' : 'days')
                  : scheduleType === 'weekly' ? (every === 1 ? 'week' : 'weeks')
                  : scheduleType === 'monthly' ? (every === 1 ? 'month' : 'months')
                  : (every === 1 ? 'year' : 'years')}
              </span>
            </div>

            {/* Weekly: day-of-week checkboxes */}
            {scheduleType === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">On days</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DOW.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={[
                        'w-10 h-10 rounded-full text-sm font-semibold transition-colors border',
                        days.includes(i)
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]',
                      ].join(' ')}
                    >
                      {d.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly: day of month */}
            {scheduleType === 'monthly' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#374151] font-medium shrink-0">On day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                  className="w-20 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white text-center"
                />
                <span className="text-sm text-[#475569]">of the month</span>
              </div>
            )}

            {/* Yearly: month + day */}
            {scheduleType === 'yearly' && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-[#374151] font-medium shrink-0">On</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                >
                  {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                  className="w-20 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white text-center"
                />
              </div>
            )}

            {/* Time + Start date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* ── End condition ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">End</p>
            <div className="flex gap-2">
              {(['never', 'on_date', 'after_n'] as const).map((ec) => (
                <button
                  key={ec}
                  type="button"
                  onClick={() => setEndCondition(ec)}
                  className={[
                    'px-4 py-2 rounded-[8px] text-sm font-medium border transition-colors',
                    endCondition === ec
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]',
                  ].join(' ')}
                >
                  {ec === 'never' ? 'Never' : ec === 'on_date' ? 'On date' : 'After N times'}
                </button>
              ))}
            </div>
            {endCondition === 'on_date' && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-48 border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                />
              </div>
            )}
            {endCondition === 'after_n' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#374151] font-medium">After</span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={endAfter}
                  onChange={(e) => setEndAfter(Math.max(1, Number(e.target.value)))}
                  className="w-24 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white text-center"
                />
                <span className="text-sm text-[#475569]">occurrences</span>
              </div>
            )}
          </div>

          {/* ── Assignees ──────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Assignees</p>
            <AssigneeSelector orgId={orgId} value={assignees} onChange={setAssignees} />
          </div>

          {/* ── Completion settings ────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Completion</p>
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
            type="submit"
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
  onPause,
  onResume,
  onDelete,
}: {
  template: RecurringTemplate
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onDelete: () => void
}) {
  const [toggling, setToggling] = useState(false)
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

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <QuadrantBadge quadrant={template.quadrant} />
            <span className={[
              'inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium',
              template.is_active
                ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
            ].join(' ')}>
              {template.is_active ? 'Active' : 'Paused'}
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-[#0F172A] truncate">{template.title}</h3>
          {template.description && (
            <p className="text-sm text-[#475569] mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleToggle}
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
              onClick={() => setShowDeleteMenu((v) => !v)}
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
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#475569]">
        <div className="flex items-center gap-1.5">
          <RotateCcw size={12} className="text-[#94A3B8]" />
          <span>{scheduleLabel(template)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-[#94A3B8]" />
          <span>From {formatDate(template.start_date)}</span>
        </div>
        <span className="text-[#CBD5E1]">·</span>
        <span className="text-[#475569]">{template.occurrence_count} occurrence{template.occurrence_count !== 1 ? 's' : ''}</span>
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
  const orgId = user?.organizationId ?? ''

  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

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
              onPause={() => handlePause(t.id)}
              onResume={() => handleResume(t.id)}
              onDelete={() => handleDelete(t.id)}
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
    </div>
  )
}
