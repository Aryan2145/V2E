'use client'

import React, { useEffect, useState } from 'react'
import { Plus, X, TrendingUp } from 'lucide-react'
import EmployeePicker, { type EmployeePickerOption } from '@/components/ui/EmployeePicker'
import { tasksApi } from '@/lib/api/tasks'

const MAX_LEVELS = 5

interface Props {
  orgId: string
  /** Ordered escalation contacts — position 0 is Level 1 (alerted first). */
  value: string[]
  onChange: (userIds: string[]) => void
}

/**
 * Collapsible "Escalation" card (Create Task + Edit Recurring). When the task goes
 * past its deadline the escalation engine alerts these people one level at a time
 * (Level 1 first, then Level 2 an hour later, and so on).
 */
export default function EscalationLevelsField({ orgId, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [employees, setEmployees] = useState<EmployeePickerOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  // '' rows are levels added but not yet filled — kept local to this field. The
  // parent value only seeds the initial rows: both host modals unmount when they
  // close, so a fresh mount always starts from the parent's current list. (No
  // resync effect — it couldn't tell a parent reset from the echo of our own
  // onChange, which filters out empty placeholder rows.)
  const [rows, setRows] = useState<string[]>(value)

  useEffect(() => {
    if (!open || loaded || !orgId) return
    tasksApi
      .getEligibleAssignees(orgId)
      .then((res) => {
        const opts: EmployeePickerOption[] = []
        res.departments.forEach((dept) =>
          dept.users.forEach((u) =>
            opts.push({ user_id: u.user_id, name: u.name, role_title: u.role_title, department_name: u.department_name }),
          ),
        )
        setEmployees(opts)
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoaded(true))
  }, [open, loaded, orgId])

  function emit(next: string[]) {
    setRows(next)
    onChange(next.filter(Boolean))
  }

  function setLevel(idx: number, uid: string) {
    setRowError(null)
    const existingAt = rows.findIndex((r, i) => r === uid && i !== idx)
    if (uid && existingAt >= 0) {
      setRowError(`That person is already Level ${existingAt + 1}.`)
      return
    }
    const next = [...rows]
    next[idx] = uid
    emit(next)
  }

  function removeLevel(idx: number) {
    setRowError(null)
    emit(rows.filter((_, i) => i !== idx))
  }

  function addLevel() {
    setRowError(null)
    if (rows.length >= MAX_LEVELS) return
    setRows([...rows, ''])
  }

  const filledCount = rows.filter(Boolean).length

  return (
    <div>
      <div className="rounded-[12px] border border-[#E2E8F0] bg-white overflow-visible">
        {/* Card header — click anywhere to toggle; + button on the right */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-[#F8FAFC] transition-colors"
        >
          <label className="text-sm font-medium text-[#374151] cursor-pointer shrink-0">Escalation</label>
          <span className="text-xs font-normal text-[#475569] shrink-0">Optional</span>
          {filledCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold shrink-0">
              {filledCount}
            </span>
          )}
          {!open && filledCount > 0 && (
            <span className="min-w-0 flex-1 truncate text-xs text-[#475569]">
              {filledCount} level{filledCount !== 1 ? 's' : ''} set
            </span>
          )}
          <span
            className={[
              'ml-auto flex items-center justify-center w-6 h-6 rounded-[6px] text-[#2563EB] transition-transform shrink-0',
              open ? 'rotate-45' : '',
            ].join(' ')}
            aria-hidden
          >
            <Plus size={18} />
          </span>
        </button>

        {open && (
          <div className="px-3 pb-3 pt-0 space-y-2">
            <p className="text-xs text-[#475569] flex items-start gap-1.5">
              <TrendingUp size={13} className="mt-0.5 shrink-0 text-[#94A3B8]" />
              If the task goes past its deadline, these people are alerted one level at a time — Level 1 first,
              then the next level an hour later if it stays open.
            </p>
            {rows.map((uid, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="shrink-0 w-14 text-xs font-semibold text-[#475569]">Level {idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <EmployeePicker
                    value={uid}
                    onChange={(v) => setLevel(idx, v)}
                    employees={employees}
                    title={`Escalate to (Level ${idx + 1})`}
                    placeholder={loaded ? 'Pick a person…' : 'Loading people…'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLevel(idx)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                  aria-label={`Remove level ${idx + 1}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {rowError && <p className="text-xs text-[#DC2626]">{rowError}</p>}
            {rows.length < MAX_LEVELS && (
              <button
                type="button"
                onClick={addLevel}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
              >
                <Plus size={14} /> Add escalation level
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
