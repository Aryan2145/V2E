'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import EmployeePicker from '@/components/ui/EmployeePicker'
import { useToast } from '@/components/ui/Toast'
import { goalsApi } from '@/lib/api/goals'
import {
  CADENCE_META,
  CADENCE_OPTIONS,
  LEVEL_META,
  PERSPECTIVE_META,
  type Goal,
  type GoalCadence,
  type GoalLevel,
  type GoalPerspective,
  type CreateGoalInput,
} from '@/lib/types/goals'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'

const PERSPECTIVES: GoalPerspective[] = ['financial', 'customer', 'internal_process', 'learning_growth']

interface EmployeeOption {
  user_id: string
  name: string
  role_title?: string | null
  department_name?: string | null
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
  /** Fixed parent (when creating from a parent's detail page). */
  parent?: Goal | null
  /** Selectable parents (when creating from a list page) — renders a parent dropdown. */
  parentOptions?: Goal[]
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
  parentOptions,
  employees,
  departments,
  onCreated,
}: Props) {
  const { addToast } = useToast()
  const meta = LEVEL_META[level]

  // The level a parent must be: objective → annual → quarterly.
  const parentLevel: GoalLevel = level === 'quarterly' ? 'annual' : 'objective'
  const parentMeta = LEVEL_META[parentLevel]
  // When no fixed parent is supplied (creating from a list page), let the user pick one.
  const selectableParent = !parent && level !== 'objective'

  const [parentId, setParentId] = useState('')
  const effectiveParent = useMemo<Goal | null>(
    () => parent ?? parentOptions?.find((p) => p.id === parentId) ?? null,
    [parent, parentOptions, parentId],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [perspective, setPerspective] = useState<GoalPerspective | ''>('')
  const [cadence, setCadence] = useState<GoalCadence>('none')
  const [measures, setMeasures] = useState<MeasureRow[]>([])
  const [minDate, setMinDate] = useState(todayStr())
  const [maxDate, setMaxDate] = useState('')
  const [clampNote, setClampNote] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset form fields on open
  useEffect(() => {
    if (!isOpen) return
    setTitle('')
    setDescription('')
    setOwnerId('')
    setDepartmentId('')
    setStartDate('')
    setMeasures([])
    setPerspective('')
    setCadence('none')
    setParentId(parent?.id ?? '')
  }, [isOpen, parent])

  // Resolve date bounds + smart default whenever the (effective) parent changes
  useEffect(() => {
    if (!isOpen) return
    setClampNote(false)

    if (level === 'objective' || !effectiveParent) {
      setMinDate(todayStr())
      setMaxDate('')
      setDueDate('')
      return
    }

    // Annual / quarterly: ask backend for bounds + smart default
    goalsApi
      .nextDefault(orgId, effectiveParent.id)
      .then((nd) => {
        setMinDate(nd.min_date)
        setMaxDate(nd.max_date)
        setDueDate(nd.suggested ?? '')
        setClampNote(nd.clamped)
        // Sub-goals default to the parent goal's perspective, but may be changed.
        if (level === 'quarterly' && nd.perspective) setPerspective(nd.perspective)
      })
      .catch(() => {
        setMinDate(todayStr())
        setMaxDate(effectiveParent.due_date.slice(0, 10))
        if (level === 'quarterly' && effectiveParent.perspective) setPerspective(effectiveParent.perspective)
      })
  }, [isOpen, level, effectiveParent, orgId])

  const ownerOptions = useMemo(
    () => employees.filter((e) => e.user_id && e.name),
    [employees],
  )

  function updateMeasure(i: number, patch: Partial<MeasureRow>) {
    setMeasures((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectableParent && !parentId) return addToast(`${parentMeta.label} is required`, 'error')
    if (!title.trim()) return addToast('Title is required', 'error')
    if (!ownerId) return addToast('Owner is required', 'error')
    if (!dueDate) return addToast('Due date is required', 'error')
    if (level !== 'objective' && !perspective) return addToast('Perspective is required', 'error')

    const dto: CreateGoalInput = {
      level,
      title: title.trim(),
      owner_user_id: ownerId,
      due_date: new Date(dueDate).toISOString(),
    }
    if (description.trim()) dto.description = description.trim()
    if (departmentId) dto.department_id = departmentId
    if (startDate) dto.start_date = new Date(startDate).toISOString()
    if (effectiveParent) dto.parent_goal_id = effectiveParent.id
    if (level !== 'objective' && perspective) dto.perspective = perspective as GoalPerspective
    if (cadence !== 'none') dto.review_cadence = cadence
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
      : effectiveParent
        ? `New ${meta.label} under "${effectiveParent.title}"`
        : `New ${meta.label}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titleText} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {selectableParent && (
          <div>
            <label className={labelClass}>{parentMeta.label} *</label>
            <select className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)} autoFocus>
              <option value="">Select {parentMeta.label.toLowerCase()}…</option>
              {parentOptions?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {parentOptions && parentOptions.length === 0 && (
              <p className="text-xs text-[#D97706] mt-1">
                No {parentMeta.plural.toLowerCase()} exist yet — create one first.
              </p>
            )}
          </div>
        )}

        <div>
          <label className={labelClass}>Title *</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={level === 'objective' ? 'e.g. Become the #1 platform in our market' : 'What is the goal?'}
            autoFocus={!selectableParent}
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
        {level !== 'objective' && (
          <div>
            <label className={labelClass}>
              Balanced-Scorecard Perspective *
              {level === 'quarterly' && (
                <span className="ml-1 text-xs font-normal text-[#94A3B8]">
                  · defaults to the parent goal&apos;s, change if needed
                </span>
              )}
            </label>
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

        {/* Owner + Department */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Owner *</label>
            <EmployeePicker
              value={ownerId}
              onChange={setOwnerId}
              employees={ownerOptions}
              title="Select Owner"
              placeholder="Select owner…"
            />
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
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              min={minDate}
              max={maxDate || undefined}
              placeholder="Select date"
            />
          </div>
          <div>
            <label className={labelClass}>Target / due date *</label>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              min={minDate}
              max={maxDate || undefined}
              placeholder="Select date"
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

        {/* Review cadence */}
        <div>
          <label className={labelClass}>Review cadence</label>
          <select className={inputClass} value={cadence} onChange={(e) => setCadence(e.target.value as GoalCadence)}>
            {CADENCE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CADENCE_META[c].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#64748B] mt-1">
            How often the owner checks in. Sets the next review date and keeps the goal honest.
          </p>
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
