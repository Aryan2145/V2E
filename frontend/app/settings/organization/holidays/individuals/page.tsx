'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getEmployees } from '@/lib/api/employees'
import { holidaysApi } from '@/lib/api/holidays'
import type { EmployeeProfile } from '@/lib/types'
import type { IndividualWorkingDays, IndividualHoliday } from '@/lib/types/holidays'
import { Loader2, Search, User } from 'lucide-react'
import IndividualScheduleBuilder from '@/components/holidays/IndividualScheduleBuilder'
import HolidayList from '@/components/holidays/HolidayList'
import AddHolidayForm from '@/components/holidays/AddHolidayForm'
import HolidayCalendar from '@/components/holidays/HolidayCalendar'

export default function IndividualsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [schedules, setSchedules] = useState<IndividualWorkingDays[]>([])
  const [holidays, setHolidays] = useState<IndividualHoliday[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [calRefresh, setCalRefresh] = useState(0)

  useEffect(() => {
    if (!orgId) return
    getEmployees(orgId).then(setEmployees).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    if (!selected || !orgId) return
    setEmpLoading(true)
    Promise.all([
      holidaysApi.listUserWorkingDays(orgId, selected.user_id),
      holidaysApi.listUserHolidays(orgId, selected.user_id),
    ]).then(([wd, hols]) => {
      setSchedules(wd)
      setHolidays(hols)
    }).finally(() => setEmpLoading(false))
  }, [selected, orgId])

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase()
    return (
      e.user_id.toLowerCase().includes(q) ||
      (e.employee_code ?? '').toLowerCase().includes(q)
    )
  })

  async function addSchedule(data: Parameters<typeof holidaysApi.createUserWorkingDays>[2]) {
    if (!selected) return
    const created = await holidaysApi.createUserWorkingDays(orgId, selected.user_id, data)
    setSchedules((s) => [...s, created])
  }

  async function deleteSchedule(id: string) {
    if (!selected) return
    await holidaysApi.deleteUserWorkingDays(orgId, selected.user_id, id)
    setSchedules((s) => s.filter((x) => x.id !== id))
    setCalRefresh((n) => n + 1)
  }

  async function updateSchedule(id: string, patch: Partial<IndividualWorkingDays>) {
    if (!selected) return
    const updated = await holidaysApi.updateUserWorkingDays(orgId, selected.user_id, id, patch)
    setSchedules((s) => s.map((x) => x.id === id ? updated : x))
    setCalRefresh((n) => n + 1)
  }

  async function addHoliday(data: { name: string; date: string; type: IndividualHoliday['type']; is_recurring_yearly: boolean; description: string }) {
    if (!selected) return
    const created = await holidaysApi.createUserHoliday(orgId, selected.user_id, { ...data, status: 'active', description: data.description || null })
    setHolidays((h) => [...h, created])
    setCalRefresh((n) => n + 1)
  }

  async function deleteHoliday(id: string) {
    if (!selected) return
    await holidaysApi.deleteUserHoliday(orgId, selected.user_id, id)
    setHolidays((h) => h.filter((x) => x.id !== id))
    setCalRefresh((n) => n + 1)
  }

  async function updateHoliday(id: string, patch: Partial<IndividualHoliday>) {
    if (!selected) return
    await holidaysApi.updateUserHoliday(orgId, selected.user_id, id, patch)
    setHolidays((h) => h.map((x) => x.id === id ? { ...x, ...patch } : x))
    setCalRefresh((n) => n + 1)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-[#94A3B8]" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Individual Calendars</h1>
        <p className="text-[15px] text-[#475569] mt-1">Set custom working schedules and personal holidays per employee.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Employee search list */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0]">
              <Search size={13} className="text-[#94A3B8] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees..."
                className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
              />
            </div>
          </div>
          <div className="divide-y divide-[#E2E8F0] max-h-[calc(100vh-260px)] overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-4 py-4 text-sm text-[#94A3B8] text-center">No employees found.</p>
            )}
            {filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelected(emp)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                  selected?.id === emp.id
                    ? 'bg-[#EFF6FF] text-[#2563EB]'
                    : 'text-[#0F172A] hover:bg-[#F8FAFC]',
                ].join(' ')}
              >
                <User size={14} className="shrink-0 text-[#94A3B8]" />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${selected?.id === emp.id ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>
                    {emp.employee_code ?? emp.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-[#94A3B8] truncate">{emp.employment_type}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="space-y-5">
            {empLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 size={20} className="animate-spin text-[#94A3B8]" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
                  <div className="space-y-5">
                    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                      <h2 className="text-[18px] font-semibold text-[#0F172A] mb-3">Working Schedules</h2>
                      <IndividualScheduleBuilder
                        schedules={schedules}
                        onAdd={addSchedule}
                        onDelete={deleteSchedule}
                        onUpdate={updateSchedule}
                      />
                    </div>

                    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                      <h2 className="text-[18px] font-semibold text-[#0F172A] mb-3">Personal Holidays</h2>
                      <HolidayList
                        holidays={holidays}
                        onDelete={deleteHoliday}
                        onUpdate={updateHoliday}
                        emptyText="No personal holidays set."
                      />
                      <div className="mt-3">
                        <AddHolidayForm onAdd={addHoliday} buttonLabel="Add Personal Holiday" />
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <HolidayCalendar
                      orgId={orgId}
                      userId={selected.user_id}
                      refreshKey={calRefresh}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <p className="text-[#94A3B8] text-sm">Select an employee to view their schedule.</p>
          </div>
        )}
      </div>
    </div>
  )
}
