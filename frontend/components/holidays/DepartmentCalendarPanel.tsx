'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save } from 'lucide-react'
import { holidaysApi } from '@/lib/api/holidays'
import type { DepartmentHoliday, DepartmentWorkingDays } from '@/lib/types/holidays'
import WorkingDaysToggle from './WorkingDaysToggle'
import HolidayList from './HolidayList'
import AddHolidayForm from './AddHolidayForm'
import HolidayCalendar from './HolidayCalendar'

interface Props {
  orgId: string
  deptId: string
  deptName: string
}

export default function DepartmentCalendarPanel({ orgId, deptId, deptName }: Props) {
  const [workingDays, setWorkingDays] = useState<DepartmentWorkingDays | null>(null)
  const [localDays, setLocalDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [useCustom, setUseCustom] = useState(false)
  const [holidays, setHolidays] = useState<DepartmentHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [savingDays, setSavingDays] = useState(false)
  const [calRefresh, setCalRefresh] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wd, hols] = await Promise.all([
        holidaysApi.getDeptWorkingDays(orgId, deptId),
        holidaysApi.listDeptHolidays(orgId, deptId),
      ])
      if (wd) {
        setWorkingDays(wd)
        setLocalDays(wd.working_days)
        setUseCustom(true)
      } else {
        setUseCustom(false)
      }
      setHolidays(hols)
    } finally {
      setLoading(false)
    }
  }, [orgId, deptId])

  useEffect(() => { load() }, [load])

  async function saveDays() {
    setSavingDays(true)
    try {
      if (useCustom) {
        await holidaysApi.upsertDeptWorkingDays(orgId, deptId, localDays)
      } else {
        if (workingDays) await holidaysApi.deleteDeptWorkingDays(orgId, deptId)
      }
      await load()
      setCalRefresh((n) => n + 1)
    } finally {
      setSavingDays(false)
    }
  }

  async function addHoliday(data: { name: string; date: string; type: DepartmentHoliday['type']; is_recurring_yearly: boolean; description: string }) {
    await holidaysApi.createDeptHoliday(orgId, deptId, { ...data, status: 'active', description: data.description || null })
    await load()
    setCalRefresh((n) => n + 1)
  }

  async function deleteHoliday(id: string) {
    await holidaysApi.deleteDeptHoliday(orgId, deptId, id)
    setHolidays((h) => h.filter((x) => x.id !== id))
    setCalRefresh((n) => n + 1)
  }

  async function updateHoliday(id: string, patch: Partial<DepartmentHoliday>) {
    await holidaysApi.updateDeptHoliday(orgId, deptId, id, patch)
    setHolidays((h) => h.map((x) => x.id === id ? { ...x, ...patch } : x))
    setCalRefresh((n) => n + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 size={20} className="animate-spin text-[#94A3B8]" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
      <div className="space-y-5">
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h3 className="text-base font-semibold text-[#0F172A] mb-3">{deptName} — Working Days</h3>
          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="w-4 h-4 accent-[#2563EB]"
            />
            <span className="text-sm text-[#475569]">Override org defaults for this department</span>
          </label>
          {useCustom && (
            <div className="mb-3">
              <WorkingDaysToggle value={localDays} onChange={setLocalDays} />
            </div>
          )}
          <button
            type="button"
            disabled={savingDays}
            onClick={saveDays}
            className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
          >
            <Save size={14} />
            {savingDays ? 'Saving...' : 'Save Working Days'}
          </button>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h3 className="text-base font-semibold text-[#0F172A] mb-3">Department Holidays</h3>
          <HolidayList holidays={holidays} onDelete={deleteHoliday} onUpdate={updateHoliday} emptyText="No department-specific holidays." />
          <div className="mt-3">
            <AddHolidayForm onAdd={addHoliday} buttonLabel="Add Department Holiday" />
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <HolidayCalendar orgId={orgId} deptId={deptId} refreshKey={calRefresh} />
      </div>
    </div>
  )
}
