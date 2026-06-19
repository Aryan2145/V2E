'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { holidaysApi } from '@/lib/api/holidays'
import type { HolidayMasterConfig, HolidayOnTaskAction, HolidayPriorityLevel } from '@/lib/types/holidays'
import { Loader2, Save } from 'lucide-react'
import HolidayConfigCard from '@/components/holidays/HolidayConfigCard'
import AccessRightsCard from '@/components/holidays/AccessRightsCard'

export default function HolidaysOverviewPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const isAdmin = !!user?.is_admin

  const [config, setConfig] = useState<HolidayMasterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    holidaysApi.getConfig(orgId).then(setConfig).finally(() => setLoading(false))
  }, [orgId])

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      const updated = await holidaysApi.updateConfig(orgId, {
        holiday_on_task_action: config.holiday_on_task_action,
        priority_level: config.priority_level,
        org_manage_roles: config.org_manage_roles,
        dept_manage_roles: config.dept_manage_roles,
        individual_manage_roles: config.individual_manage_roles,
      })
      setConfig(updated)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#94A3B8]" />
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Holiday & Working Days</h1>
        <p className="text-[15px] text-[#475569] mt-1">Configure how your organization handles holidays and deadline adjustments.</p>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-[18px] font-semibold text-[#0F172A] mb-4">Behavior</h2>

        <HolidayConfigCard
          action={config.holiday_on_task_action}
          priority={config.priority_level}
          onActionChange={(a: HolidayOnTaskAction) => setConfig((c) => c ? { ...c, holiday_on_task_action: a } : c)}
          onPriorityChange={(p: HolidayPriorityLevel) => setConfig((c) => c ? { ...c, priority_level: p } : c)}
          disabled={!isAdmin}
        />

        {isAdmin && (
          <div className="mt-5">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="flex items-center gap-2 h-10 px-5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
            >
              <Save size={15} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h2 className="text-[18px] font-semibold text-[#0F172A] mb-4">Access Rights</h2>
          <AccessRightsCard
            orgManageRoles={config.org_manage_roles}
            deptManageRoles={config.dept_manage_roles}
            individualManageRoles={config.individual_manage_roles}
            onOrgChange={(roles) => setConfig((c) => c ? { ...c, org_manage_roles: roles } : c)}
            onDeptChange={(roles) => setConfig((c) => c ? { ...c, dept_manage_roles: roles } : c)}
            onIndividualChange={(roles) => setConfig((c) => c ? { ...c, individual_manage_roles: roles } : c)}
          />
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="mt-4 flex items-center gap-2 h-10 px-5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Access Rights'}
          </button>
        </div>
      )}
    </div>
  )
}
