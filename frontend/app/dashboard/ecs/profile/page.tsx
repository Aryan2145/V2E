'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import DatePicker from '@/components/ui/DatePicker'
import { getMyProfile, updateMyProfile } from '@/lib/api/employees'
import type { EmployeeProfile } from '@/lib/types'

const employmentLabel: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
}

function toDateInput(iso?: string): string {
  return iso ? iso.slice(0, 10) : ''
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#475569] mb-1">{label}</p>
      <p className="text-sm text-[#0F172A]">{value || '—'}</p>
    </div>
  )
}

export default function MyProfilePage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { addToast } = useToast()

  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dob, setDob] = useState('')
  const [marriage, setMarriage] = useState('')

  const load = useCallback(async () => {
    if (!orgId) return
    const p = await getMyProfile(orgId)
    setProfile(p)
    setDob(toDateInput(p.date_of_birth))
    setMarriage(toDateInput(p.marriage_date))
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    load().catch(() => addToast('Could not load your profile', 'error')).finally(() => setLoading(false))
  }, [load, addToast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!profile) {
    return <p className="text-sm text-[#475569]">No employee profile found for your account.</p>
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await updateMyProfile(orgId, {
        date_of_birth: dob || null,
        marriage_date: marriage || null,
      })
      setProfile(updated)
      addToast('Profile updated', 'success')
    } catch (e: any) {
      const m = e?.response?.data?.message ?? 'Could not update profile'
      addToast(Array.isArray(m) ? m.join(', ') : m, 'error')
    } finally {
      setSaving(false)
    }
  }

  const cardCls = 'bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5'

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-[22px] font-semibold text-[#0F172A]">My Profile</h1>

      {/* Work details — read only */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Lock size={14} className="text-[#94A3B8]" />
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Work details</h2>
          <span className="text-xs text-[#94A3B8]">Managed by your administrator</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ReadOnly label="Name" value={profile.user?.name ?? ''} />
          <ReadOnly label="Email" value={profile.user?.email ?? ''} />
          <ReadOnly label="Employee code" value={profile.employee_code ?? ''} />
          <ReadOnly label="Role" value={profile.role?.title ?? ''} />
          <ReadOnly label="Department" value={profile.department?.name ?? ''} />
          <ReadOnly label="Reporting to" value={profile.reporting_to?.name ?? ''} />
          <ReadOnly label="Employment type" value={employmentLabel[profile.employment_type] ?? profile.employment_type} />
          <ReadOnly label="Date of joining" value={toDateInput(profile.date_of_joining)} />
          <ReadOnly label="Status" value={profile.status === 'active' ? 'Active' : 'Inactive'} />
        </div>
      </div>

      {/* Personal details — editable */}
      <div className={cardCls}>
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Personal details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Date of birth</label>
            <DatePicker value={dob} onChange={setDob} max={new Date().toISOString().slice(0, 10)} placeholder="Select date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Marriage date</label>
            <DatePicker value={marriage} onChange={setMarriage} max={new Date().toISOString().slice(0, 10)} placeholder="Select date" />
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save personal details'}
        </button>
      </div>
    </div>
  )
}
