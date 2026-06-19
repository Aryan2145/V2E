'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { holidaysApi } from '@/lib/api/holidays'
import type { HolidayAuditLog, HolidayEntityType } from '@/lib/types/holidays'
import { Loader2 } from 'lucide-react'
import HolidayAuditTable from '@/components/holidays/HolidayAuditTable'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]
const ENTITY_TYPES: { value: HolidayEntityType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'task', label: 'Task' },
  { value: 'recurring_task', label: 'Recurring Task' },
  { value: 'workflow_step', label: 'Workflow Step' },
  { value: 'ticket', label: 'Ticket' },
]

export default function AuditLogPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [logs, setLogs] = useState<HolidayAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [entityType, setEntityType] = useState<HolidayEntityType | ''>('')

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    holidaysApi.getAuditLog(orgId, {
      year,
      entity_type: entityType || undefined,
    }).then(setLogs).finally(() => setLoading(false))
  }, [orgId, year, entityType])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Audit Log</h1>
        <p className="text-[15px] text-[#475569] mt-1">View all deadline adjustments caused by holiday rules.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={[
                'h-8 px-3 rounded-[8px] text-sm font-medium border transition-colors',
                year === y
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB]',
              ].join(' ')}
            >
              {y}
            </button>
          ))}
        </div>

        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as HolidayEntityType | '')}
          className="h-8 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] bg-white focus:border-[#2563EB] outline-none"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-[#94A3B8]" />
        </div>
      ) : (
        <HolidayAuditTable logs={logs} />
      )}
    </div>
  )
}
