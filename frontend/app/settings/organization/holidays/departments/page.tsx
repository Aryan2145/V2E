'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getDepartments } from '@/lib/api/departments'
import type { Department } from '@/lib/types'
import { Loader2, ChevronRight } from 'lucide-react'
import DepartmentCalendarPanel from '@/components/holidays/DepartmentCalendarPanel'

export default function DepartmentsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Department | null>(null)

  useEffect(() => {
    if (!orgId) return
    getDepartments(orgId).then((depts) => {
      setDepartments(depts)
      if (depts.length > 0) setSelected(depts[0])
    }).finally(() => setLoading(false))
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#94A3B8]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Department Calendars</h1>
        <p className="text-[15px] text-[#475569] mt-1">Override working days and add department-specific holidays.</p>
      </div>

      {departments.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <p className="text-[#94A3B8] text-sm">No departments found. Create departments first in Org Chart.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Dept list */}
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
            <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide">Departments</p>
            </div>
            <div className="divide-y divide-[#E2E8F0] max-h-[calc(100vh-260px)] overflow-y-auto">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setSelected(dept)}
                  className={[
                    'w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors',
                    selected?.id === dept.id
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                      : 'text-[#0F172A] hover:bg-[#F8FAFC]',
                  ].join(' ')}
                >
                  <span className="truncate">{dept.name}</span>
                  <ChevronRight size={14} className="shrink-0 text-[#94A3B8]" />
                </button>
              ))}
            </div>
          </div>

          {/* Panel */}
          {selected && (
            <DepartmentCalendarPanel
              key={selected.id}
              orgId={orgId}
              deptId={selected.id}
              deptName={selected.name}
            />
          )}
        </div>
      )}
    </div>
  )
}
