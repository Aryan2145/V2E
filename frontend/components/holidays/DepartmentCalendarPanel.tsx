'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, ChevronLeft, ChevronRight, Unlink, Undo2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { holidaysApi } from '@/lib/api/holidays'
import { getDepartments } from '@/lib/api/departments'
import type { DepartmentHoliday, CalendarHoliday } from '@/lib/types/holidays'
import type { Department } from '@/lib/types'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DeptWorkingWeekStrip from './DeptWorkingWeekStrip'
import OrgHolidayList from './OrgHolidayList'
import OrgHolidayCalendar from './OrgHolidayCalendar'
import HolidayFormModal, { type HolidayFormData } from './HolidayFormModal'

const YEARS_BASE = new Date().getFullYear()

interface Props {
  orgId: string
  deptId: string
  deptName: string
}

export default function DepartmentCalendarPanel({ orgId, deptId, deptName }: Props) {
  const { user } = useAuth()
  const isAdmin = !!user?.is_admin

  const [orgWorkingDays, setOrgWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [override, setOverride] = useState(false)
  const [deptDays, setDeptDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const [holidays, setHolidays] = useState<DepartmentHoliday[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedYear, setSelectedYear] = useState(YEARS_BASE)
  const [loading, setLoading] = useState(true)
  const [holidaysLoading, setHolidaysLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // Opt-out (local detach of an inherited holiday) — confirm dialog + undo toast.
  const [optOutTarget, setOptOutTarget] = useState<CalendarHoliday | null>(null)
  const [optingOut, setOptingOut] = useState(false)
  const [undoToast, setUndoToast] = useState<{ id: string; name: string } | null>(null)

  const effectiveDays = override ? deptDays : orgWorkingDays

  const loadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [org, dept, depts] = await Promise.all([
        holidaysApi.getOrgWorkingDays(orgId),
        holidaysApi.getDeptWorkingDays(orgId, deptId),
        getDepartments(orgId),
      ])
      setDepartments(depts)
      setOrgWorkingDays(org.working_days)
      if (dept) {
        setOverride(true)
        setDeptDays(dept.working_days)
      } else {
        setOverride(false)
        setDeptDays(org.working_days)
      }
    } finally {
      setLoading(false)
    }
  }, [orgId, deptId])

  const loadHolidays = useCallback(async () => {
    setHolidaysLoading(true)
    try {
      const hols = await holidaysApi.listDeptHolidays(orgId, deptId, { year: selectedYear })
      setHolidays(hols)
    } finally {
      setHolidaysLoading(false)
    }
  }, [orgId, deptId, selectedYear])

  useEffect(() => { loadBase() }, [loadBase])
  useEffect(() => { loadHolidays() }, [loadHolidays])

  // Clear the "Saved" note after a moment.
  useEffect(() => {
    if (status !== 'saved') return
    const t = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(t)
  }, [status])

  async function persistDays(days: number[]) {
    setStatus('saving')
    try {
      await holidaysApi.upsertDeptWorkingDays(orgId, deptId, days)
      setStatus('saved')
    } catch {
      setStatus('idle')
      await loadBase()
    }
  }

  function toggleDay(index: number) {
    if (!override || !isAdmin) return
    const next = deptDays.includes(index)
      ? deptDays.filter((d) => d !== index)
      : [...deptDays, index].sort((a, b) => a - b)
    setDeptDays(next) // optimistic
    persistDays(next)
  }

  async function toggleOverride(next: boolean) {
    if (!isAdmin) return
    if (next) {
      // Start overriding from the current org defaults.
      setOverride(true)
      setDeptDays(orgWorkingDays)
      await persistDays(orgWorkingDays)
    } else {
      setOverride(false)
      setDeptDays(orgWorkingDays)
      setStatus('saving')
      try {
        await holidaysApi.deleteDeptWorkingDays(orgId, deptId)
        setStatus('saved')
      } catch {
        setStatus('idle')
        await loadBase()
      }
    }
  }

  async function addHoliday(data: HolidayFormData) {
    await holidaysApi.createDeptHoliday(orgId, deptId, {
      ...data,
      end_date: data.end_date || null,
      status: 'active',
      description: data.description || null,
      target_department_ids: data.target_department_ids,
    })
    await loadHolidays()
  }

  async function deleteHoliday(id: string) {
    await holidaysApi.deleteDeptHoliday(orgId, deptId, id)
    setHolidays((h) => h.filter((x) => x.id !== id))
  }

  async function updateHoliday(id: string, patch: { name?: string; date?: string }) {
    await holidaysApi.updateDeptHoliday(orgId, deptId, id, patch)
    await loadHolidays()
  }

  async function confirmOptOut() {
    if (!optOutTarget) return
    setOptingOut(true)
    try {
      await holidaysApi.optOutDeptHoliday(orgId, deptId, optOutTarget.id)
      setUndoToast({ id: optOutTarget.id, name: optOutTarget.name })
      setOptOutTarget(null)
      await loadHolidays()
    } finally {
      setOptingOut(false)
    }
  }

  async function undoOptOut() {
    if (!undoToast) return
    const id = undoToast.id
    setUndoToast(null)
    await holidaysApi.undoOptOutDeptHoliday(orgId, deptId, id)
    await loadHolidays()
  }

  // Auto-dismiss the undo toast after a few seconds.
  useEffect(() => {
    if (!undoToast) return
    const t = setTimeout(() => setUndoToast(null), 6000)
    return () => clearTimeout(t)
  }, [undoToast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-[#94A3B8]" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[18px] font-semibold text-[#0F172A]">{deptName}</h3>
        <p className="text-sm text-[#475569] mt-0.5">Set this department&apos;s working week and holidays. They override the org defaults.</p>
      </div>

      {/* Working week — slim strip with override switch */}
      <DeptWorkingWeekStrip
        days={effectiveDays}
        override={override}
        status={status}
        disabled={!isAdmin}
        onToggleDay={toggleDay}
        onToggleOverride={toggleOverride}
      />

      {/* Holidays + calendar, side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start lg:items-stretch">
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-semibold text-[#0F172A]">Holidays</h2>
              <div className="flex items-center gap-1 rounded-[8px] border border-[#CBD5E1] bg-white">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1.5 rounded-l-[7px] text-[#475569] hover:bg-[#F1F5F9] transition-colors"
                  aria-label="Previous year"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-[44px] text-center text-sm font-semibold text-[#0F172A] tabular-nums">{selectedYear}</span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1.5 rounded-r-[7px] text-[#475569] hover:bg-[#F1F5F9] transition-colors"
                  aria-label="Next year"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
              >
                <Plus size={15} />
                New Holiday
              </button>
            )}
          </div>

          {holidaysLoading ? (
            <div className="flex items-center justify-center h-16"><Loader2 size={18} className="animate-spin text-[#94A3B8]" /></div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto lg:max-h-[360px]">
              <OrgHolidayList
                holidays={holidays}
                onDelete={deleteHoliday}
                onUpdate={updateHoliday}
                onOptOut={(h) => setOptOutTarget(h)}
                emptyText="No department-specific holidays."
              />
            </div>
          )}
        </div>

        <OrgHolidayCalendar workingDays={effectiveDays} holidays={holidays} />
      </div>

      <HolidayFormModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addHoliday}
        title="New Department Holiday"
        departments={departments}
        originDeptId={deptId}
        originDeptName={deptName}
      />

      {/* Opt-out (local detach) confirmation — amber, because it's reversible. */}
      <Modal
        isOpen={!!optOutTarget}
        onClose={() => !optingOut && setOptOutTarget(null)}
        title="Opt out of inherited holiday"
        size="sm"
      >
        {optOutTarget && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] p-3">
              <Unlink size={16} className="text-[#D97706] mt-0.5 shrink-0" />
              <p className="text-sm text-[#1E293B]">
                Remove <span className="font-semibold">{optOutTarget.name}</span>, inherited from{' '}
                <span className="font-semibold">{optOutTarget.source_department_name}</span>, from{' '}
                <span className="font-semibold">{deptName}</span>?
              </p>
            </div>
            <ul className="text-sm text-[#475569] space-y-1.5 list-disc pl-5">
              <li>It applies only to <span className="font-medium text-[#0F172A]">{deptName}</span> and the departments under it.</li>
              <li><span className="font-medium text-[#0F172A]">{optOutTarget.source_department_name}</span> and all other departments keep it.</li>
              <li>
                {optOutTarget.source_department_head_name
                  ? <>{optOutTarget.source_department_head_name}, head of {optOutTarget.source_department_name}, will be notified</>
                  : <>The head of {optOutTarget.source_department_name} will be notified</>}
                {' '}and it will be recorded in the audit log.
              </li>
              <li>Nothing is deleted — you can re-attach it any time.</li>
            </ul>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setOptOutTarget(null)} disabled={optingOut}>Cancel</Button>
              <Button
                variant="primary"
                onClick={confirmOptOut}
                isLoading={optingOut}
                disabled={optingOut}
                className="!bg-[#D97706] hover:!bg-[#B45309]"
              >
                Opt out
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Undo toast — a few seconds to reverse an accidental opt-out. */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 rounded-[10px] bg-[#0F172A] text-white px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.25)]">
          <span className="text-sm">Opted out of <span className="font-semibold">{undoToast.name}</span></span>
          <button
            type="button"
            onClick={undoOptOut}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#93C5FD] hover:text-white transition-colors"
          >
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}
    </div>
  )
}
