'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import { useToast } from '@/components/ui/Toast'
import { goalsApi } from '@/lib/api/goals'
import { STATUS_META, type Goal, type GoalStatus, type UpdateGoalInput } from '@/lib/types/goals'
import { toDateInput } from './shared'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'
const STATUSES: GoalStatus[] = ['not_started', 'on_track', 'at_risk', 'achieved', 'archived']
const todayStr = () => new Date().toISOString().slice(0, 10)

interface MeasureRow {
  name: string
  target_value: string
  unit: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  goal: Goal
  employees: { user_id: string; name: string }[]
  departments: { id: string; name: string }[]
  onSaved: (goal: Goal) => void
}

export default function EditGoalModal({ isOpen, onClose, orgId, goal, employees, departments, onSaved }: Props) {
  const { addToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<GoalStatus>('not_started')
  const [measures, setMeasures] = useState<MeasureRow[]>([])
  const [saving, setSaving] = useState(false)

  const maxDate = goal.parent?.due_date ? toDateInput(goal.parent.due_date) : undefined

  useEffect(() => {
    if (!isOpen) return
    setTitle(goal.title)
    setDescription(goal.description ?? '')
    setOwnerId(goal.owner_user_id)
    setDepartmentId(goal.department_id ?? '')
    setStartDate(toDateInput(goal.start_date))
    setDueDate(toDateInput(goal.due_date))
    setStatus(goal.status)
    setMeasures((goal.measures ?? []).map((m) => ({ name: m.name, target_value: m.target_value, unit: m.unit ?? '' })))
  }, [isOpen, goal])

  function updateMeasure(i: number, patch: Partial<MeasureRow>) {
    setMeasures((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return addToast('Title is required', 'error')
    if (!dueDate) return addToast('Due date is required', 'error')

    const dto: UpdateGoalInput = {
      title: title.trim(),
      description: description.trim(),
      owner_user_id: ownerId,
      department_id: departmentId || undefined,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      due_date: new Date(dueDate).toISOString(),
      status,
      measures: measures
        .filter((m) => m.name.trim() && m.target_value.trim())
        .map((m) => ({ name: m.name.trim(), target_value: m.target_value.trim(), unit: m.unit.trim() || undefined })),
    }

    setSaving(true)
    try {
      const updated = await goalsApi.update(orgId, goal.id, dto)
      addToast('Goal updated', 'success')
      onSaved(updated)
      onClose()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to update goal', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit goal" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Title *</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea className={`${inputClass} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Owner *</label>
            <select className={inputClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {employees.map((e) => (
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
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Start date</label>
            <DatePicker value={startDate} onChange={setStartDate} max={maxDate} placeholder="Select date" />
          </div>
          <div>
            <label className={labelClass}>Due date *</label>
            <DatePicker value={dueDate} onChange={setDueDate} min={todayStr()} max={maxDate} placeholder="Select date" />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
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
          <div className="flex flex-col gap-2">
            {measures.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputClass} placeholder="Measure" value={m.name} onChange={(e) => updateMeasure(i, { name: e.target.value })} />
                <input className={`${inputClass} w-28`} placeholder="Target" value={m.target_value} onChange={(e) => updateMeasure(i, { target_value: e.target.value })} />
                <input className={`${inputClass} w-24`} placeholder="Unit" value={m.unit} onChange={(e) => updateMeasure(i, { unit: e.target.value })} />
                <button type="button" onClick={() => setMeasures((r) => r.filter((_, idx) => idx !== i))} className="text-[#94A3B8] hover:text-[#DC2626] shrink-0" aria-label="Remove measure">
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
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
