'use client'

import React, { useState, useEffect } from 'react'
import { X, Info } from 'lucide-react'
import { tasksApi } from '@/lib/api/tasks'
import type {
  RecurringTemplate, RecurringScheduleEntry,
  TaskCategory, TaskPriority, CompletionMode, SelectedAssignee, YearlyDate,
} from '@/lib/types/tasks'
import AssigneeSelector from '@/components/tasks/AssigneeSelector'
import ScheduleEntryList from '@/components/tasks/ScheduleEntryList'
import type { ScheduleEntryDraft } from '@/components/tasks/ScheduleEntryRow'

export interface EditRecurringModalProps {
  template: RecurringTemplate
  orgId: string
  categories: TaskCategory[]
  priorities: TaskPriority[]
  onClose: () => void
  onUpdated: (t: RecurringTemplate) => void
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

export default function EditRecurringModal({ template, orgId, categories, priorities, onClose, onUpdated }: EditRecurringModalProps) {
  const [title, setTitle] = useState(template.title)
  const [description, setDescription] = useState(template.description ?? '')
  const [priorityId, setPriorityId] = useState(template.priority_id ?? '')
  const [categoryId, setCategoryId] = useState(template.category_id ?? '')
  const [completionMode, setCompletionMode] = useState<CompletionMode>(template.completion_mode as CompletionMode)
  const [proofRequired, setProofRequired] = useState(template.proof_required)
  const [assignees, setAssignees] = useState<SelectedAssignee[]>([])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryDraft[]>(
    (template.schedule_entries ?? []).length > 0
      ? (template.schedule_entries ?? []).map(entryToScheduleEntryDraft)
      : [defaultEntry()]
  )

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
      const result = await tasksApi.updateRecurring(orgId, template.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority_id: priorityId || undefined,
        category_id: categoryId || undefined,
        completion_mode: completionMode,
        proof_required: proofRequired,
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
        })) as never,
        ...(assignees.length > 0 && {
          assignee_user_ids: assignees.filter((a) => !a.is_cc).map((a) => a.user_id),
          cc_user_ids: assignees.filter((a) => a.is_cc).map((a) => a.user_id),
        }),
      })
      onUpdated(result!)
    } catch {
      setError('Failed to save changes. Please try again.')
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
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="text-[22px] font-semibold text-[#0F172A]">Edit Recurring Template</h2>
            <p className="text-sm text-[#475569] mt-0.5">Changes apply to future task instances only.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          <div className="flex gap-3 bg-[#FFF7ED] border border-[#FED7AA] rounded-[10px] px-4 py-3">
            <Info size={16} className="text-[#EA580C] shrink-0 mt-0.5" />
            <div className="text-sm text-[#9A3412] space-y-1">
              <p className="font-semibold">What happens when you save?</p>
              <ul className="list-disc list-inside space-y-0.5 text-[13px]">
                <li>Already-created task instances are <span className="font-medium">not affected</span> — they stay as-is.</li>
                <li>The next scheduled task and all future ones will follow your updated settings.</li>
                <li>Schedule changes <span className="font-medium">fully replace</span> the existing schedule.</li>
                <li>Leave Assignees empty to keep current assignees unchanged.</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3 text-sm text-[#DC2626]">{error}</div>
          )}

          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Task Details</p>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Title <span className="text-[#DC2626]">*</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Assignees
                {(template.assignee_user_ids?.length ?? 0) > 0 && (
                  <span className="ml-2 text-xs font-normal text-[#94A3B8]">({template.assignee_user_ids.length} currently — add new to replace)</span>
                )}
              </label>
              <AssigneeSelector orgId={orgId} value={assignees} onChange={setAssignees} />
            </div>
            {primaryAssigneeCount > 1 && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">Completion Mode</label>
                <div className="flex gap-4">
                  {(['any_can_complete', 'all_must_complete'] as CompletionMode[]).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="editCompletionMode" value={mode} checked={completionMode === mode} onChange={() => setCompletionMode(mode)} className="accent-[#2563EB]" />
                      <span className="text-sm text-[#1E293B]">{mode === 'any_can_complete' ? 'Any assignee can complete' : 'All must complete'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..." rows={2} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Priority</label>
                <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white">
                  <option value="">No priority</option>
                  {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white">
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Schedule</p>
            <ScheduleEntryList entries={scheduleEntries} onChange={setScheduleEntries} />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Completion</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setProofRequired((v) => !v)} className={['relative w-10 h-5 rounded-full transition-colors', proofRequired ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'].join(' ')} role="switch" aria-checked={proofRequired}>
                <span className={['absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', proofRequired ? 'translate-x-5' : ''].join(' ')} />
              </button>
              <span className="text-sm text-[#1E293B] font-medium">Proof of completion required</span>
            </div>
          </div>
        </form>

        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          <button type="button" onClick={onClose} className="px-5 py-[10px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors">
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
