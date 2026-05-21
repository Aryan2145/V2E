'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { holidaysApi } from '@/lib/api/holidays'
import type { HolidayMasterConfig, HolidayOnTaskAction, HolidayPriorityLevel } from '@/lib/types/holidays'
import { CalendarDays, Building2, Users, ClipboardList, AlertTriangle, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import HolidayConfigCard from '@/components/holidays/HolidayConfigCard'
import AccessRightsCard from '@/components/holidays/AccessRightsCard'
import CountrySelector from '@/components/holidays/CountrySelector'

export default function HolidaysOverviewPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const isAdmin = user?.role === 'org_admin' || user?.role === 'hr_manager'

  const [config, setConfig] = useState<HolidayMasterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      holidaysApi.getConfig(orgId),
      holidaysApi.getPendingNational(orgId, currentYear),
      holidaysApi.getPendingNational(orgId, currentYear + 1),
    ]).then(([cfg, p1, p2]) => {
      setConfig(cfg)
      setPendingCount(p1.length + p2.length)
    }).finally(() => setLoading(false))
  }, [orgId, currentYear])

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      const updated = await holidaysApi.updateConfig(orgId, {
        country_code: config.country_code,
        holiday_on_task_action: config.holiday_on_task_action,
        priority_level: config.priority_level,
        auto_fetch_national_holidays: config.auto_fetch_national_holidays,
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

  const SECTION_LINKS = [
    { label: 'Org Calendar', desc: 'Manage org-wide holidays and working days', href: '/dashboard/holidays/org', icon: <CalendarDays size={20} className="text-[#2563EB]" /> },
    { label: 'Department Calendars', desc: 'Override schedules per department', href: '/dashboard/holidays/departments', icon: <Building2 size={20} className="text-[#7C3AED]" /> },
    { label: 'Individual Calendars', desc: 'Set custom schedules per employee', href: '/dashboard/holidays/individuals', icon: <Users size={20} className="text-[#0891B2]" />, adminOnly: true },
    { label: 'Audit Log', desc: 'View all deadline adjustments history', href: '/dashboard/holidays/audit', icon: <ClipboardList size={20} className="text-[#D97706]" />, adminOnly: true },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Holiday & Working Days</h1>
        <p className="text-[15px] text-[#475569] mt-1">Configure how your organization handles holidays and deadline adjustments.</p>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-[12px] bg-[#FFFBEB] border border-[#FDE68A]">
          <AlertTriangle size={18} className="text-[#D97706] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#92400E]">
              {pendingCount} national holiday{pendingCount !== 1 ? 's' : ''} pending review
            </p>
            <p className="text-xs text-[#78350F] mt-0.5">
              Go to <Link href="/dashboard/holidays/org" className="underline">Org Calendar</Link> to review and activate them.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-[18px] font-semibold text-[#0F172A] mb-4">Country & Behavior</h2>

        <div className="mb-5">
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Country</label>
          <div className="max-w-xs">
            <CountrySelector
              orgId={orgId}
              value={config.country_code}
              onChange={(cc) => setConfig((c) => c ? { ...c, country_code: cc } : c)}
              disabled={!isAdmin}
            />
          </div>
          <p className="text-xs text-[#475569] mt-1">Used to auto-fetch national holidays from Nager.Date.</p>
        </div>

        <HolidayConfigCard
          action={config.holiday_on_task_action}
          priority={config.priority_level}
          onActionChange={(a: HolidayOnTaskAction) => setConfig((c) => c ? { ...c, holiday_on_task_action: a } : c)}
          onPriorityChange={(p: HolidayPriorityLevel) => setConfig((c) => c ? { ...c, priority_level: p } : c)}
          disabled={!isAdmin}
        />

        <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.auto_fetch_national_holidays}
            onChange={(e) => setConfig((c) => c ? { ...c, auto_fetch_national_holidays: e.target.checked } : c)}
            disabled={!isAdmin}
            className="w-4 h-4 accent-[#2563EB]"
          />
          <span className="text-sm text-[#475569]">Auto-fetch national holidays every January 1st for review</span>
        </label>

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

      <div>
        <h2 className="text-[18px] font-semibold text-[#0F172A] mb-3">Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTION_LINKS.map((s) => {
            if ((s as {adminOnly?: boolean}).adminOnly && !isAdmin) return null
            return (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-start gap-4 p-5 bg-white border border-[#E2E8F0] rounded-[12px] hover:border-[#2563EB]/40 hover:shadow-md transition-all shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              >
                <div className="p-2.5 rounded-[10px] bg-[#F8FAFC] border border-[#E2E8F0] shrink-0">
                  {s.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{s.label}</p>
                  <p className="text-xs text-[#475569] mt-0.5">{s.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
