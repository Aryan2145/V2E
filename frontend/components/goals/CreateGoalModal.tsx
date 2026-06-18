'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { goalsApi } from '@/lib/api/goals'
import {
  LEVEL_META,
  PERSPECTIVE_META,
  type Goal,
  type GoalLevel,
  type GoalPerspective,
  type CreateGoalInput,
} from '@/lib/types/goals'
import { PerspectiveBadge } from './shared'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'

const PERSPECTIVES: GoalPerspective[] = ['financial', 'customer', 'internal_process', 'learning_growth']

interface EmployeeOption {
  user_id: string
  name: string
}
interface DeptOption {
  id: string
  name: string
}
interface MeasureRow {
  name: string
  target_value: string
  unit: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  level: GoalLevel
  parent?: Goal | null
  employees: EmployeeOption[]
  departments: DeptOption[]
  onCreated: (goal: Goal) => void
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function CreateGoalModal({
  isOpen,
  onClose,
  orgId,
  level,
  parent,
  employees,
  departments,
  onCreated,
}: Props) {
  const { addToast } = useToast()
  const meta = LEVEL_META[level]

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [perspective, setPerspective] = useState<GoalPerspective | ''>('')
  const [inheritedPerspective, setInheritedPerspective] = useState<GoalPerspective | null>(null)
  const [measures, setMeasures] = useState<MeasureRow[]>([])
  const [minDate, setMinDate] = useState(todayStr())
  const [maxDate, setMaxDate] = useState('')
  const [clampNote, setClampNote] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset + prefill on open
  useEffect(() => {
    if (!isOpen) return
    setTitle('')
    setDescription('')
    setOwnerId('')
    setDepartmentId('')
    setStartDate('')
    setMeasures([])
    setPerspective('')
    setInheritedPerspective(null)
    setClampNote(false)

    if (level === 'objective' || !parent) {
      setMinDate(todayStr())
      setMaxDate('')
      setDueDate('')
      return
    }

    // Annual / quarterly: ask backend for bounds + smart default
    goalsApi
      .nextDefault(orgId, parent.id)
      .then((nd) => {
        setMinDate(nd.min_date)
        setMaxDate(nd.max_date)
        setDueDate(nd.suggested ?? '')
        setClampNote(nd.clamped)
        if (level === 'quarterly') setInheritedPerspective(nd.perspective)
      })
      .catch(() => {
        setMinDate(todayStr())
        setMaxDate(parent.due_date.slice(0, 10))
      })
  }, [isOpen, level, parent, orgId])

  const ownerOptions = useMemo(
    () => employees.filter((e) => e.user_id && e.name),
    [employees],
  )

  function updateMeasure(i: number, patch: Partial<MeasureRow>) {
    setMeasures((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return addToast('Title is required', 'error')
    if (!ownerId) return addToast('Owner is required', 'error')
    if (!dueDate) return addToast('Due date is required', 'error')
    if (level === 'annual' && !perspective) return addToast('Perspective is required', 'error')

    const dto: CreateGoalInput = {
      level,
      title: title.trim(),
      owner_user_id: ownerId,
      due_date: new Date(dueDate).toISOString(),
    }
    if (description.trim()) dto.description = description.trim()
    if (departmentId) dto.department_id = departmentId
    if (startDate) dto.start_date = new Date(startDate).toISOString()
    if (parent) dto.parent_goal_id = parent.id
    if (level === 'annual') dto.perspective = perspective as GoalPerspective
    const cleanMeasures = measures
      .filter((m) => m.name.trim() && m.target_value.trim())
      .map((m) => ({ name: m.name.trim(), target_value: m.target_value.trim(), unit: m.unit.trim() || undefined }))
    if (cleanMeasures.length) dto.measures = cleanMeasures

    setSaving(true)
    try {
      const goal = await goalsApi.create(orgId, dto)
      addToast(`${meta.label} created`, 'success')
      onCreated(goal)
      onClose()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? `Failed to create ${meta.label.toLowerCase()}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const titleText =
    level === 'objective'
      ? 'New Objective'
      : level === 'annual'
        ? `New Annual Goal under "${parent?.title ?? ''}"`
        : `New Quarterly Goal under "${parent?.title ?? ''}"`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titleText} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Title *</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={level === 'objective' ? 'e.g. Become the #1 platform in our market' : 'What is the goal?'}
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The qualitative 'what' of this goal"
          />
        </div>

        {/* Perspective */}
        {level === 'annual' && (
          <div>
            <label className={labelClass}>Balanced-Scorecard Perspective *</label>
            <div className="grid grid-cols-2 gap-2">
              {PERSPECTIVES.map((p) => {
                const active = perspective === p
                const m = PERSPECTIVE_META[p]
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPerspective(p)}
                    className={[
                      'flex items-center gap-2 px-3 py-2 rounded-[8px] border text-sm font-medium transition-colors text-left',
                      active ? 'border-[#2563EB] bg-[#EFF6FF] text-[#0F172A]' : 'border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]',
                    ].join(' ')}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.accent }} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {level === 'quarterly' && (
          <div>
            <label className={labelClass}>Perspective (inherited)</label>
            <div className="flex items-center gap-2">
              {inheritedPerspective ? (
                <PerspectiveBadge perspective={inheritedPerspective} />
              ) : (
                <span className="text-sm text-[#94A3B8]">Inherited from the parent annual goal</span>
              )}
              <span className="text-xs text-[#94A3B8]">· set on the annual goal, never re-picked</span>
            </div>
          </div>
        )}

        {/* Owner + Department */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Owner *</label>
            <select className={inputClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Select owner…</option>
              {ownerOptions.map((e) => (
                <option key={e.user_id} value={e.user_id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start date</label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              min={minDate}
              max={maxDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Target / due date *</label>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              min={minDate}
              max={maxDate || undefined}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {maxDate && (
              <p className="text-xs text-[#64748B] mt-1">
                Must be on or before {new Date(maxDate).toLocaleDateString()} (parent&apos;s due date).
              </p>
            )}
            {clampNote && (
              <p className="text-xs text-[#D97706] mt-1">
                Default was capped at the parent&apos;s due date.
              </p>
            )}
          </div>
        </div>

        {/* Measures */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass + ' mb-0'}>Measures &amp; targets</label>
            <button
              type="button"
              onClick={() => setMeasures((r) => [...r, { name: '', target_value: '', unit: '' }])}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              <Plus size={14} /> Add measure
            </button>
          </div>
          {measures.length === 0 && (
            <p className="text-xs text-[#94A3B8]">A measure is a metric to track (e.g. &quot;active hospitals&quot;) with a target value.</p>
          )}
          <div className="flex flex-col gap-2">
            {measures.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  placeholder="Measure (e.g. active hospitals)"
                  value={m.name}
                  onChange={(e) => updateMeasure(i, { name: e.target.value })}
                />
                <input
                  className={`${inputClass} w-28`}
                  placeholder="Target"
                  value={m.target_value}
                  onChange={(e) => updateMeasure(i, { target_value: e.target.value })}
                />
                <input
                  className={`${inputClass} w-24`}
                  placeholder="Unit"
                  value={m.unit}
                  onChange={(e) => updateMeasure(i, { unit: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setMeasures((r) => r.filter((_, idx) => idx !== i))}
                  className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"
                  aria-label="Remove measure"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={saving} disabled={saving}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Create {meta.label}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
