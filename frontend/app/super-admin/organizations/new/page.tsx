'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ChevronLeft, Search, Check } from 'lucide-react'
import { createOrganization } from '@/lib/api/organizations'
import { getGroups, getGroupUsers } from '@/lib/api/groups'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import type { OrganizationGroup } from '@/lib/types'
import type { GroupUser } from '@/lib/api/groups'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  industry: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  group_id: z.string().optional(),
  is_test: z.boolean().optional(),
  admin_name: z.string().optional(),
  admin_email: z.string().optional(),
  admin_password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label, error, required, hint, children,
}: {
  label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#374151]">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      {!error && hint && <p className="text-xs text-[#64748B]">{hint}</p>}
    </div>
  )
}

const inputCls = (hasError?: boolean) =>
  [
    'w-full rounded-[8px] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none transition-colors',
    hasError ? 'border-2 border-[#DC2626]' : 'border border-[#CBD5E1] focus:border-2 focus:border-[#2563EB]',
  ].join(' ')

const selectCls = (hasError?: boolean) =>
  [
    'w-full rounded-[8px] bg-white px-3 py-[10px] text-sm text-[#0F172A] focus:outline-none transition-colors',
    hasError ? 'border-2 border-[#DC2626]' : 'border border-[#CBD5E1] focus:border-2 focus:border-[#2563EB]',
  ].join(' ')

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewOrganizationPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Admin tab state: 'new' | 'existing'
  const [adminTab, setAdminTab] = useState<'new' | 'existing'>('new')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserName, setSelectedUserName] = useState<string>('')

  // Groups
  const [groups, setGroups] = useState<OrganizationGroup[]>([])
  const [groupUsers, setGroupUsers] = useState<GroupUser[]>([])
  const [loadingGroupUsers, setLoadingGroupUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    getGroups().then(setGroups).catch(() => setGroups([]))
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: 'Asia/Kolkata' },
  })

  const selectedGroupId = watch('group_id')

  // Load group users whenever selected group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setGroupUsers([])
      setSelectedUserId(null)
      setSelectedUserName('')
      setAdminTab('new')
      return
    }
    setLoadingGroupUsers(true)
    getGroupUsers(selectedGroupId)
      .then(setGroupUsers)
      .catch(() => setGroupUsers([]))
      .finally(() => setLoadingGroupUsers(false))
  }, [selectedGroupId])

  const filteredUsers = groupUsers.filter((u) => {
    const q = userSearch.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)

    // Validate admin section
    if (adminTab === 'existing') {
      if (!selectedUserId) {
        setServerError('Please select an existing user as admin.')
        return
      }
    } else {
      if (!values.admin_email) {
        setServerError('Admin email is required.')
        return
      }
      if (!values.admin_name) {
        setServerError('Admin name is required.')
        return
      }
    }

    try {
      const payload: Parameters<typeof createOrganization>[0] = {
        name: values.name,
        industry: values.industry || undefined,
        country: values.country || undefined,
        timezone: values.timezone || undefined,
        group_id: values.group_id || undefined,
        is_test: values.is_test || undefined,
      }

      if (adminTab === 'existing' && selectedUserId) {
        payload.existing_user_id = selectedUserId
      } else {
        payload.admin_name = values.admin_name
        payload.admin_email = values.admin_email
        payload.admin_password = values.admin_password || undefined
      }

      await createOrganization(payload)
      router.push('/super-admin/organizations')
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-[#475569] hover:text-[#0F172A] mb-3 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Create Organization</h1>
        <p className="text-sm text-[#475569] mt-1">Set up a new tenant organization and provision its first admin account.</p>
      </div>

      {serverError && (
        <div className="rounded-[8px] bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-sm text-[#DC2626]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Section 1 — Org details */}
        <Card>
          <h2 className="text-[16px] font-semibold text-[#0F172A] mb-5 pb-4 border-b border-[#E2E8F0]">Organization Details</h2>
          <div className="grid grid-cols-1 gap-5">
            <Field label="Organization Name" error={errors.name?.message} required>
              <input
                {...register('name')}
                placeholder="Acme Corp"
                className={inputCls(!!errors.name)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry" error={errors.industry?.message}>
                <select {...register('industry')} className={selectCls(!!errors.industry)}>
                  <option value="">Select industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Media">Media</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Country" error={errors.country?.message}>
                <select {...register('country')} className={selectCls(!!errors.country)}>
                  <option value="">Select country</option>
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Singapore">Singapore</option>
                  <option value="UAE">UAE</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>

            <Field label="Timezone" error={errors.timezone?.message}>
              <select {...register('timezone')} className={selectCls(!!errors.timezone)}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              </select>
            </Field>

            {/* Group selector */}
            <Field label="Group" hint="Optional — assign this org to an existing group">
              <select {...register('group_id')} className={selectCls()}>
                <option value="">No group (standalone)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </Field>

            {/* Test client toggle */}
            <label className="flex items-start gap-3 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('is_test')}
                className="mt-0.5 w-4 h-4 rounded border-[#CBD5E1] text-[#D97706] focus:ring-[#D97706]"
              />
              <span>
                <span className="block text-sm font-medium text-[#92400E]">Test client</span>
                <span className="block text-xs text-[#B45309] mt-0.5">
                  Enables a controllable simulated clock so this org can “time travel” for testing. Leave off for real clients.
                </span>
              </span>
            </label>
          </div>
        </Card>

        {/* Section 2 — First Admin Account */}
        <Card>
          <h2 className="text-[16px] font-semibold text-[#0F172A] mb-1 pb-4 border-b border-[#E2E8F0]">First Admin Account</h2>

          {/* Tabs — only show "Existing User" tab when a group is selected */}
          <div className="flex gap-0 mt-4 mb-5 border border-[#E2E8F0] rounded-[8px] overflow-hidden">
            <button
              type="button"
              onClick={() => setAdminTab('new')}
              className={[
                'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                adminTab === 'new' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F8FAFC]',
              ].join(' ')}
            >
              New User
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('existing')}
              disabled={!selectedGroupId}
              className={[
                'flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-[#E2E8F0]',
                !selectedGroupId ? 'bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed' :
                  adminTab === 'existing' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F8FAFC]',
              ].join(' ')}
            >
              Existing User {!selectedGroupId && <span className="text-[11px]">(select a group first)</span>}
            </button>
          </div>

          {adminTab === 'new' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Admin Name" error={errors.admin_name?.message} required>
                  <input {...register('admin_name')} placeholder="Jane Smith" className={inputCls(!!errors.admin_name)} />
                </Field>
                <Field label="Admin Email" error={errors.admin_email?.message} required>
                  <input {...register('admin_email')} type="email" placeholder="jane@acme.com" className={inputCls(!!errors.admin_email)} />
                </Field>
              </div>
              <Field label="Password" error={errors.admin_password?.message} hint="Leave blank if this email already has an account">
                <div className="relative">
                  <input
                    {...register('admin_password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className={[inputCls(!!errors.admin_password), 'pr-10'].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
            </div>
          )}

          {adminTab === 'existing' && selectedGroupId && (
            <div className="flex flex-col gap-3">
              {selectedUserId && (
                <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#F0FDF4] border border-[#BBF7D0]">
                  <Check size={16} className="text-[#16A34A] shrink-0" />
                  <p className="text-sm font-medium text-[#16A34A]">{selectedUserName} selected as admin</p>
                  <button
                    type="button"
                    onClick={() => { setSelectedUserId(null); setSelectedUserName('') }}
                    className="ml-auto text-xs text-[#475569] hover:text-[#DC2626] transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              {!selectedUserId && (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full rounded-[8px] bg-white border border-[#CBD5E1] pl-9 pr-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors"
                    />
                  </div>

                  {loadingGroupUsers ? (
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-[8px] bg-[#F1F5F9] animate-pulse" />
                      ))}
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-sm text-[#94A3B8] text-center py-4">
                      {groupUsers.length === 0 ? 'No users in this group yet.' : 'No users match your search.'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto rounded-[8px] border border-[#E2E8F0]">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.user_id}
                          type="button"
                          onClick={() => { setSelectedUserId(u.user_id); setSelectedUserName(u.name) }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[#EFF6FF] text-left transition-colors border-b border-[#E2E8F0] last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-semibold">{u.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0F172A] truncate">{u.name}</p>
                            <p className="text-xs text-[#475569] truncate">{u.email}</p>
                            <p className="text-[11px] text-[#94A3B8]">
                              Member of: {u.orgs.map((o) => o.name).join(', ')}
                            </p>
                          </div>
                          <span className="text-xs text-[#2563EB] font-medium shrink-0">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" isLoading={isSubmitting}>Create Organization</Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/super-admin/organizations')} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
