'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { holidaysApi } from '@/lib/api/holidays'
import type { DepartmentHoliday } from '@/lib/types/holidays'
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
  const [selectedYear, setSelectedYear] = useState(YEARS_BASE)
  const [loading, setLoading] = useState(true)
  const [holidaysLoading, setHolidaysLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const effectiveDays = override ? deptDays : orgWorkingDays

  const loadBase = useCallback(async () => {
    setLoading(true)
    try {
      const [org, dept] = await Promise.all([
        holidaysApi.getOrgWorkingDays(orgId),
        holidaysApi.getDeptWorkingDays(orgId, deptId),
      ])
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
      />
    </div>
  )
}
