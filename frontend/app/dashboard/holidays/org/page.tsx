'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { holidaysApi } from '@/lib/api/holidays'
import type { OrgHoliday, OrgWorkingDays } from '@/lib/types/holidays'
import { Loader2, Save, Upload } from 'lucide-react'
import WorkingDaysToggle from '@/components/holidays/WorkingDaysToggle'
import HolidayList from '@/components/holidays/HolidayList'
import AddHolidayForm from '@/components/holidays/AddHolidayForm'
import HolidayCalendar from '@/components/holidays/HolidayCalendar'
import ImportHolidaysModal from '@/components/holidays/ImportHolidaysModal'

const YEARS = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1]

export default function OrgCalendarPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const isAdmin = user?.role === 'org_admin' || user?.role === 'hr_manager'

  const [workingDays, setWorkingDays] = useState<OrgWorkingDays | null>(null)
  const [localDays, setLocalDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [savingDays, setSavingDays] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [holidays, setHolidays] = useState<OrgHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [calRefresh, setCalRefresh] = useState(0)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [wd, hols] = await Promise.all([
        holidaysApi.getOrgWorkingDays(orgId),
        holidaysApi.listOrgHolidays(orgId, { year: selectedYear, status: 'active' }),
      ])
      setWorkingDays(wd)
      setLocalDays(wd.working_days)
      setHolidays(hols)
    } finally {
      setLoading(false)
    }
  }, [orgId, selectedYear])

  useEffect(() => { load() }, [load])

  async function saveDays() {
    setSavingDays(true)
    try {
      const updated = await holidaysApi.updateOrgWorkingDays(orgId, localDays)
      setWorkingDays(updated)
      setCalRefresh((n) => n + 1)
    } finally {
      setSavingDays(false)
    }
  }

  async function addHoliday(data: { name: string; date: string; type: OrgHoliday['type']; is_recurring_yearly: boolean; description: string }) {
    await holidaysApi.createOrgHoliday(orgId, { ...data, status: 'active', source: 'manual', description: data.description || null })
    await load()
    setCalRefresh((n) => n + 1)
  }

  async function deleteHoliday(id: string) {
    await holidaysApi.deleteOrgHoliday(orgId, id)
    setHolidays((h) => h.filter((x) => x.id !== id))
    setCalRefresh((n) => n + 1)
  }

  async function updateHoliday(id: string, patch: Partial<OrgHoliday>) {
    await holidaysApi.updateOrgHoliday(orgId, id, patch)
    setHolidays((h) => h.map((x) => x.id === id ? { ...x, ...patch } : x))
    setCalRefresh((n) => n + 1)
  }

  if (loading && !workingDays) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-[#94A3B8]" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Org Calendar</h1>
        <p className="text-[15px] text-[#475569] mt-1">Manage organization-wide working days and holidays.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <div className="space-y-5">
          {/* Working Days */}
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <h2 className="text-[18px] font-semibold text-[#0F172A] mb-3">Working Days</h2>
            <WorkingDaysToggle value={localDays} onChange={setLocalDays} disabled={!isAdmin} />
            {isAdmin && (
              <button
                type="button"
                disabled={savingDays}
                onClick={saveDays}
                className="mt-4 flex items-center gap-2 h-9 px-4 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
              >
                <Save size={14} />
                {savingDays ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>

          {/* National Holidays section */}
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[18px] font-semibold text-[#0F172A]">National Holidays</h2>
              <div className="flex gap-2">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedYear(y)}
                    className={[
                      'h-8 px-3 rounded-[8px] text-sm font-medium border transition-colors',
                      selectedYear === y
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB]',
                    ].join(' ')}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-16"><Loader2 size={18} className="animate-spin text-[#94A3B8]" /></div>
            ) : (
              <>
                <HolidayList
                  holidays={holidays}
                  onDelete={deleteHoliday}
                  onUpdate={updateHoliday}
                  emptyText="No holidays for this year."
                />

                {isAdmin && (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <AddHolidayForm onAdd={addHoliday} />
                    <button
                      type="button"
                      onClick={() => setShowImport(true)}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0F172A] transition-colors"
                    >
                      <Upload size={14} />
                      Import CSV
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="hidden lg:block">
          <HolidayCalendar orgId={orgId} refreshKey={calRefresh} />
        </div>
      </div>

      {showImport && (
        <ImportHolidaysModal
          orgId={orgId}
          onClose={() => setShowImport(false)}
          onImported={() => { load(); setCalRefresh((n) => n + 1) }}
        />
      )}
    </div>
  )
}
