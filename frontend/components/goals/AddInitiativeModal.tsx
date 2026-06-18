'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { tasksApi } from '@/lib/api/tasks'

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'

interface Props {
  isOpen: boolean
  onClose: () => void
  orgId: string
  goalId: string
  employees: { user_id: string; name: string }[]
  onCreated: () => void
}

/**
 * Reuses the existing Task module — creates a task linked to a quarterly goal via
 * goal_id. Keeps fields minimal (title, executor, deadline); full task editing
 * happens in the Tasks module.
 */
export default function AddInitiativeModal({ isOpen, onClose, orgId, goalId, employees, onCreated }: Props) {
  const { addToast } = useToast()
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [deadline, setDeadline] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setAssignee('')
      setDeadline('')
    }
  }, [isOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return addToast('Task title is required', 'error')
    if (!assignee) return addToast('An executor (assignee) is required', 'error')

    setSaving(true)
    try {
      await tasksApi.createTask(orgId, {
        title: title.trim(),
        assignee_user_ids: [assignee],
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        goal_id: goalId,
      })
      addToast('Initiative added', 'success')
      onCreated()
      onClose()
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to add initiative', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add initiative" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-[#475569] -mt-1">
          Initiatives are tasks from the Task module linked to this quarterly goal.
        </p>
        <div>
          <label className={labelClass}>Task title *</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
        </div>
        <div>
          <label className={labelClass}>Executor (assignee) *</label>
          <select className={inputClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Select executor…</option>
            {employees.map((e) => (
              <option key={e.user_id} value={e.user_id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Deadline</label>
          <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={saving} disabled={saving}>
            Add initiative
          </Button>
        </div>
      </form>
    </Modal>
  )
}
