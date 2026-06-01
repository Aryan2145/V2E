'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Trash2, Plus, X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { tasksApi } from '@/lib/api/tasks'
import type { EligibleAssigneeUser } from '@/lib/types/tasks'
import type { WorkflowStep, WorkflowNature, WorkflowRecurringType, DeadlineConfig } from '@/lib/types/workflows'

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const avatarColors = ['bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]', 'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]']
function avatarColor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}
function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

// ─── User search for assignee ─────────────────────────────────────────────────

function AssigneeUserSearch({ orgId, value, displayName, onChange }: {
  orgId: string
  value: string
  displayName: string
  onChange: (userId: string, name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EligibleAssigneeUser[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await tasksApi.getEligibleAssignees(orgId, q || undefined, 'name')
        setResults(data.departments.flatMap((d) => d.users))
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 200)
  }, [orgId])

  useEffect(() => {
    if (open) fetch(query)
  }, [query, open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (value && displayName) {
    const name = displayName
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-[8px] border border-[#CBD5E1] bg-white">
        <div className={`w-6 h-6 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
          {getInitials(name)}
        </div>
        <span className="text-sm text-[#0F172A] flex-1 truncate">{name}</span>
        <button type="button" onClick={() => onChange('', '')} className="p-0.5 rounded hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#0F172A] transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search by name…"
          className="w-full h-10 pl-9 pr-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] focus:outline-none transition-colors"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#E2E8F0] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] max-h-48 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-[#94A3B8]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#94A3B8]">No users found</div>
          ) : results.map((u) => (
            <button
              key={u.user_id}
              type="button"
              onClick={() => { onChange(u.user_id, u.name); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <div className={`w-7 h-7 rounded-full ${avatarColor(u.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                {getInitials(u.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A] truncate">{u.name}</p>
                <p className="text-xs text-[#94A3B8] truncate">{u.role_title} · {u.department_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DEADLINE_TYPES = [
  { value: 'fixed_date', label: 'Fixed date' },
  { value: 'x_days_after_start', label: 'Days after workflow starts' },
  { value: 'x_days_after_prev_completed', label: 'Days after previous step completes' },
  { value: 'x_days_after_prev_deadline', label: 'Days after previous step deadline' },
  { value: 'daily', label: 'Same day (daily)' },
  { value: 'weekly', label: 'Day of week (weekly)' },
  { value: 'monthly', label: 'Day of month (monthly)' },
  { value: 'yearly', label: 'Day of year (yearly)' },
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface DeadlineConfigFieldProps {
  config: Partial<DeadlineConfig> & { type?: string }
  onChange: (config: DeadlineConfig) => void
  nature: WorkflowNature
}

function DeadlineConfigField({ config, onChange, nature }: DeadlineConfigFieldProps) {
  const type = (config as DeadlineConfig & { type: string }).type ?? 'fixed_date'

  function update(patch: Record<string, unknown>) {
    onChange({ ...config, ...patch } as DeadlineConfig)
  }

  const inputCls = 'w-full px-3 py-2 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none bg-white'

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-medium text-[#374151] mb-1">Deadline type</label>
        <select
          value={type}
          onChange={(e) => onChange({ type: e.target.value, time: '09:00' } as DeadlineConfig)}
          className={inputCls}
        >
          {DEADLINE_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>

      {type === 'fixed_date' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Date</label>
            <input type="date" value={(config as { date?: string }).date ?? ''} onChange={(e) => update({ date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Time</label>
            <input type="time" value={(config as { time?: string }).time ?? '09:00'} onChange={(e) => update({ time: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}

      {(type === 'x_days_after_start' || type === 'x_days_after_prev_completed' || type === 'x_days_after_prev_deadline') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Days</label>
            <input
              type="number" min={0} value={(config as { days?: number }).days ?? 1}
              onChange={(e) => update({ days: parseInt(e.target.value) || 1 })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Time</label>
            <input type="time" value={(config as { time?: string }).time ?? '09:00'} onChange={(e) => update({ time: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}

      {type === 'daily' && (
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Time</label>
          <input type="time" value={(config as { time?: string }).time ?? '09:00'} onChange={(e) => update({ time: e.target.value })} className={inputCls} />
        </div>
      )}

      {type === 'weekly' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Day</label>
            <select value={(config as { day?: number }).day ?? 1} onChange={(e) => update({ day: parseInt(e.target.value) })} className={inputCls}>
              {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Time</label>
            <input type="time" value={(config as { time?: string }).time ?? '09:00'} onChange={(e) => update({ time: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}

      {type === 'monthly' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Day of month</label>
            <input type="number" min={1} max={31} value={(config as { day_of_month?: number }).day_of_month ?? 1} onChange={(e) => update({ day_of_month: parseInt(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Time</label>
            <input type="time" value={(config as { time?: string }).time ?? '09:00'} onChange={(e) => update({ time: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}

      {type === 'yearly' && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Month</label>
            <select value={(config as { month?: number }).month ?? 1} onChange={(e) => update({ month: parseInt(e.target.value) })} className={inputCls}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Day</label>
            <input type="number" min={1} max={31} value={(config as { day?: number }).day ?? 1} onChange={(e) => update({ day: parseInt(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Time</label>
            <input type="time" value={(config as { time?: string }).time ?? '09:00'} onChange={(e) => update({ time: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  step: Partial<WorkflowStep>
  isFirst: boolean
  isLast: boolean
  index: number
  nature: WorkflowNature
  orgId: string
  onSave: (step: Partial<WorkflowStep>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export default function StepEditor({ step, isFirst, isLast, index, nature, orgId, onSave, onDelete, onMoveUp, onMoveDown }: Props) {
  const [draft, setDraft] = useState<Partial<WorkflowStep>>({ ...step })
  const [assigneeName, setAssigneeName] = useState('')
  const [checklistInput, setChecklistInput] = useState('')

  function update(patch: Partial<WorkflowStep>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  function addChecklistItem() {
    if (!checklistInput.trim()) return
    const items = draft.checklist_items ?? []
    update({ checklist_items: [...items, { title: checklistInput.trim(), order_index: items.length }] })
    setChecklistInput('')
  }

  function removeChecklistItem(idx: number) {
    update({ checklist_items: (draft.checklist_items ?? []).filter((_, i) => i !== idx) })
  }

  const inputCls = 'w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none bg-white'

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-semibold text-[#0F172A] truncate">{draft.title || 'Untitled step'}</span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={isFirst} onClick={onMoveUp} className="w-6 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] disabled:opacity-30 transition-colors">
            <ChevronUp size={14} />
          </button>
          <button type="button" disabled={isLast} onClick={onMoveDown} className="w-6 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] disabled:opacity-30 transition-colors">
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-4 grid grid-cols-1 gap-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Step title <span className="text-[#DC2626]">*</span></label>
          <input
            type="text"
            value={draft.title ?? ''}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => onSave(draft)}
            placeholder="e.g. Send welcome email"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Description</label>
          <textarea
            value={draft.description ?? ''}
            onChange={(e) => update({ description: e.target.value })}
            onBlur={() => onSave(draft)}
            placeholder="Optional details..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Assignee type */}
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Assignee type</label>
          <div className="flex gap-2">
            {(['fixed_person', 'role'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { update({ assignee_type: t }); onSave({ ...draft, assignee_type: t }) }}
                className={`flex-1 py-2 rounded-[7px] text-sm font-medium border transition-colors ${
                  draft.assignee_type === t
                    ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
                    : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                {t === 'fixed_person' ? 'Fixed person' : 'Role (round-robin)'}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee user / role */}
        {draft.assignee_type === 'fixed_person' ? (
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Assignee</label>
            <AssigneeUserSearch
              orgId={orgId}
              value={draft.assignee_user_id ?? ''}
              displayName={assigneeName}
              onChange={(userId, name) => {
                setAssigneeName(name)
                const updated = { ...draft, assignee_user_id: userId }
                update({ assignee_user_id: userId })
                onSave(updated)
              }}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Role</label>
            <select
              value={draft.assignee_role ?? ''}
              onChange={(e) => { update({ assignee_role: e.target.value }); onSave({ ...draft, assignee_role: e.target.value }) }}
              className={inputCls}
            >
              <option value="">Select role</option>
              <option value="org_admin">Admin</option>
              <option value="hr_manager">HR Manager</option>
              <option value="employee">Employee</option>
            </select>
          </div>
        )}

        {/* Deadline config */}
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-2">Deadline</label>
          <DeadlineConfigField
            config={(draft.deadline_config ?? { type: 'x_days_after_start', days: 1, time: '09:00' }) as DeadlineConfig & { type: string }}
            onChange={(cfg) => { update({ deadline_config: cfg }); onSave({ ...draft, deadline_config: cfg }) }}
            nature={nature}
          />
        </div>

        {/* If overdue */}
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">If overdue</label>
          <select
            value={draft.if_overdue_action ?? 'block_next'}
            onChange={(e) => { update({ if_overdue_action: e.target.value as never }); onSave({ ...draft, if_overdue_action: e.target.value as never }) }}
            className={inputCls}
          >
            <option value="block_next">Block next step</option>
            <option value="proceed_anyway">Proceed anyway</option>
            <option value="trigger_branch">Trigger branch step</option>
          </select>
        </div>

        {/* Proof required */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.proof_required ?? false}
            onChange={(e) => { update({ proof_required: e.target.checked }); onSave({ ...draft, proof_required: e.target.checked }) }}
            className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
          />
          <span className="text-sm text-[#374151]">Require proof of completion</span>
        </label>

        {/* Checklist */}
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-2">Checklist items</label>
          <div className="flex flex-col gap-1.5 mb-2">
            {(draft.checklist_items ?? []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFC] rounded-[7px] border border-[#E2E8F0]">
                <span className="flex-1 text-sm text-[#0F172A]">{item.title}</span>
                <button type="button" onClick={() => removeChecklistItem(idx)} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={checklistInput}
              onChange={(e) => setChecklistInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
              placeholder="Add checklist item..."
              className={`flex-1 ${inputCls}`}
            />
            <button
              type="button"
              onClick={addChecklistItem}
              className="px-3 py-2 rounded-[7px] bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0] transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
