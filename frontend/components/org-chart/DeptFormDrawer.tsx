'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { createDepartment, updateDepartment } from '@/lib/api/departments'
import { placeUnderParent } from '@/lib/org-chart-layout'
import { BRANCH_PALETTE } from '@/lib/org-chart-colors'
import Button from '@/components/ui/Button'
import type { Department, User } from '@/lib/types'

export type DeptFormTarget =
  | { mode: 'create'; parentId?: string }
  | { mode: 'edit'; department: Department }

interface DeptFormDrawerProps {
  target: DeptFormTarget | null
  departments: Department[]
  users: User[]
  orgId: string
  onClose: () => void
  onSaved: (saved: Department) => void
}

const inputCls =
  'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors'
const labelCls = 'text-sm font-medium text-[#374151] mb-1.5 block'

/**
 * Create or edit a department from a right-hand drawer. In edit mode the form is
 * prefilled from the department; new departments are auto-placed under their
 * parent so they don't land on top of the canvas origin.
 */
export default function DeptFormDrawer({
  target,
  departments,
  users,
  orgId,
  onClose,
  onSaved,
}: DeptFormDrawerProps) {
  const open = !!target
  const isEdit = target?.mode === 'edit'
  const editing = target?.mode === 'edit' ? target.department : null

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [headUserId, setHeadUserId] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate when the target changes.
  useEffect(() => {
    if (!target) return
    if (target.mode === 'edit') {
      setName(target.department.name)
      setDescription(target.department.description ?? '')
      setParentId(target.department.parent_department_id ?? '')
      setHeadUserId(target.department.head_user_id ?? '')
      setColor(target.department.color ?? null)
    } else {
      setName('')
      setDescription('')
      setParentId(target.parentId ?? '')
      setHeadUserId('')
      setColor(null)
    }
    setError(null)
  }, [target])

  // A department can't be its own parent (or pick a descendant — kept simple here).
  const parentOptions = departments.filter((d) => !editing || d.id !== editing.id)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Department name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let saved: Department
      if (isEdit && editing) {
        saved = await updateDepartment(orgId, editing.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          parent_department_id: parentId || undefined,
          head_user_id: headUserId || undefined,
          color, // hex string, or null to clear → inherit branch hue
        })
      } else {
        const { x, y } = placeUnderParent(departments, parentId || undefined)
        saved = await createDepartment(orgId, {
          name: name.trim(),
          description: description.trim() || undefined,
          parent_department_id: parentId || undefined,
          head_user_id: headUserId || undefined,
          color: color ?? undefined,
          position_x: x,
          position_y: y,
        })
      }
      onSaved(saved)
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response
        ?.data?.message
      setError(Array.isArray(raw) ? raw[0] : raw ?? 'Failed to save department.')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />}

      <div
        className={`fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-white border-l border-[#E2E8F0] shadow-[-8px_0_32px_rgba(0,0,0,0.08)] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="font-semibold text-[#0F172A]">
            {isEdit ? 'Edit Department' : 'Add Department'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Department Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description…"
              className="w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors resize-none"
            />
          </div>
          <div>
            <label className={labelCls}>Parent Department</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
              <option value="">None (top-level)</option>
              {parentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Department Head</label>
            <select
              value={headUserId}
              onChange={(e) => setHeadUserId(e.target.value)}
              className={inputCls}
            >
              <option value="">No head assigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Node Color</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                title="Default (inherit branch color)"
                className={`h-7 px-2.5 rounded-[7px] text-xs font-medium border transition-colors ${
                  color === null
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                    : 'border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]'
                }`}
              >
                Default
              </button>
              {BRANCH_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color?.toLowerCase() === c.toLowerCase()
                      ? 'border-[#0F172A] ring-2 ring-offset-1 ring-[#0F172A]/20'
                      : 'border-white shadow-sm'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Use color ${c}`}
                />
              ))}
            </div>
            <p className="text-xs text-[#94A3B8] mt-1.5">
              Default inherits the branch hue (lighter further down the tree).
            </p>
          </div>
          {error && <p className="text-xs text-[#DC2626]">{error}</p>}
          </div>

          <div className="px-5 pt-4 pb-12 border-t border-[#E2E8F0] flex gap-3">
            <Button variant="primary" isLoading={saving} onClick={handleSave}>
              {isEdit ? 'Save' : 'Add Department'}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
