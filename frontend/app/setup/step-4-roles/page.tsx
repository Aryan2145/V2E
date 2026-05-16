'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, ArrowRight, ChevronRight, Briefcase } from 'lucide-react'
import { getDepartments } from '@/lib/api/departments'
import { getRoles, createRole } from '@/lib/api/roles'
import { useAuth } from '@/lib/auth/context'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { Department, Role, RoleLevel } from '@/lib/types'

// ─── Role form schema ──────────────────────────────────────────────────────────

const roleSchema = z.object({
  title: z.string().min(1, 'Role title is required'),
  level: z.enum(['junior', 'mid', 'senior', 'lead', 'head'] as const),
  job_description: z.string().optional(),
  kra: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .default([]),
  kpi: z
    .array(z.object({ title: z.string(), metric: z.string(), target: z.string(), unit: z.string() }))
    .default([]),
})

type RoleFormValues = z.infer<typeof roleSchema>

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors'
const textareaCls =
  'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors resize-none'
const labelCls = 'text-sm font-medium text-[#374151] mb-1.5 block'

// ─── Level badge mapping ───────────────────────────────────────────────────────

const levelColors: Record<RoleLevel, string> = {
  junior: 'bg-[#DCFCE7] text-[#16A34A]',
  mid: 'bg-[#DBEAFE] text-[#1D4ED8]',
  senior: 'bg-[#FEF9C3] text-[#CA8A04]',
  lead: 'bg-[#FEE2E2] text-[#DC2626]',
  head: 'bg-[#F3E8FF] text-[#7C3AED]',
}

// ─── Add role form ─────────────────────────────────────────────────────────────

interface RoleFormProps {
  deptId: string
  orgId: string
  onSaved: () => void
  onCancel: () => void
}

function AddRoleForm({ deptId, orgId, onSaved, onCancel }: RoleFormProps) {
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(roleSchema) as any,
    defaultValues: { level: 'mid', kra: [], kpi: [] },
  })

  const kraArray = useFieldArray({ control, name: 'kra' })
  const kpiArray = useFieldArray({ control, name: 'kpi' })

  const onSubmit = async (data: RoleFormValues) => {
    setFormError(null)
    try {
      const payload = {
        ...data,
        department_id: deptId,
        kra: (data.kra ?? [])
          .filter((k) => k.title.trim() || k.description.trim())
          .map((k) => ({ title: k.title.trim(), description: k.description.trim() })),
        kpi: (data.kpi ?? [])
          .filter((k) => k.title.trim() || k.metric.trim() || k.target.trim() || k.unit.trim())
          .map((k) => ({
            title: k.title.trim(),
            metric: k.metric.trim(),
            target: k.target.trim(),
            unit: k.unit.trim(),
          })),
      }
      await createRole(orgId, payload)
      onSaved()
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Failed to save role.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Role Title *</label>
          <input {...register('title')} placeholder="e.g. Senior Engineer" className={inputCls} />
          {errors.title && <p className="text-xs text-[#DC2626] mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Level *</label>
          <select {...register('level')} className={inputCls}>
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
            <option value="head">Head</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Job Description</label>
        <textarea
          {...register('job_description')}
          rows={4}
          placeholder="Describe the role's responsibilities, scope, and expected outcomes…"
          className={textareaCls}
        />
      </div>

      {/* KRA Builder */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-[#0F172A]">Key Result Areas (KRA)</h4>
          <button
            type="button"
            onClick={() => kraArray.append({ title: '', description: '' })}
            className="inline-flex items-center gap-1 text-xs text-[#2563EB] font-medium hover:text-[#1D4ED8]"
          >
            <Plus size={13} /> Add KRA
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {kraArray.fields.length === 0 && (
            <p className="text-xs text-[#94A3B8] text-center py-3">No KRAs added yet.</p>
          )}
          {kraArray.fields.map((field, i) => (
            <div key={field.id} className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 flex gap-3">
              <div className="flex-1 flex flex-col gap-2">
                <input
                  {...register(`kra.${i}.title`)}
                  placeholder="KRA Title"
                  className={inputCls}
                />
                <textarea
                  {...register(`kra.${i}.description`)}
                  rows={2}
                  placeholder="Description…"
                  className={textareaCls}
                />
              </div>
              <button
                type="button"
                onClick={() => kraArray.remove(i)}
                className="text-[#94A3B8] hover:text-[#DC2626] self-start p-1 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Builder */}
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-[#0F172A]">Key Performance Indicators (KPI)</h4>
          <button
            type="button"
            onClick={() => kpiArray.append({ title: '', metric: '', target: '', unit: '' })}
            className="inline-flex items-center gap-1 text-xs text-[#2563EB] font-medium hover:text-[#1D4ED8]"
          >
            <Plus size={13} /> Add KPI
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {kpiArray.fields.length === 0 && (
            <p className="text-xs text-[#94A3B8] text-center py-3">No KPIs added yet.</p>
          )}
          {kpiArray.fields.map((field, i) => (
            <div key={field.id} className="bg-white border border-[#E2E8F0] rounded-[8px] p-3 flex gap-3">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  {...register(`kpi.${i}.title`)}
                  placeholder="KPI Title"
                  className={inputCls}
                />
                <input
                  {...register(`kpi.${i}.metric`)}
                  placeholder="Metric (e.g. Code reviews/week)"
                  className={inputCls}
                />
                <input
                  {...register(`kpi.${i}.target`)}
                  placeholder="Target value"
                  className={inputCls}
                />
                <input
                  {...register(`kpi.${i}.unit`)}
                  placeholder="Unit (e.g. %, count, hrs)"
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() => kpiArray.remove(i)}
                className="text-[#94A3B8] hover:text-[#DC2626] self-start p-1 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {formError && (
        <p className="text-sm text-[#DC2626] rounded-[8px] bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
          {formError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          Save Role
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step4RolesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organization_id ?? ''

  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingDepts, setIsLoadingDepts] = useState(true)
  const [isLoadingRoles, setIsLoadingRoles] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Load departments
  useEffect(() => {
    if (!orgId) return
    getDepartments(orgId)
      .then((data) => {
        setDepartments(data)
        if (data.length > 0) setSelectedDeptId(data[0].id)
      })
      .finally(() => setIsLoadingDepts(false))
  }, [orgId])

  // Load roles when selected dept changes
  const loadRoles = useCallback(async () => {
    if (!orgId || !selectedDeptId) return
    setIsLoadingRoles(true)
    try {
      const data = await getRoles(orgId, selectedDeptId)
      setRoles(data)
    } catch {
      setRoles([])
    } finally {
      setIsLoadingRoles(false)
    }
  }, [orgId, selectedDeptId])

  useEffect(() => {
    loadRoles()
    setShowAddForm(false)
  }, [loadRoles])

  const selectedDept = departments.find((d) => d.id === selectedDeptId)

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">Step 4 of 5</p>
        <h1 className="text-[26px] font-bold text-[#0F172A]">Roles & Job Descriptions</h1>
        <p className="text-sm text-[#475569] mt-1">
          Define roles within each department along with their job descriptions, KRAs, and KPIs.
        </p>
      </div>

      <div className="flex gap-4 min-h-[500px]">
        {/* Left: Department list */}
        <div className="w-[220px] shrink-0 bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0]">
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Departments</p>
          </div>
          <div className="flex flex-col">
            {isLoadingDepts ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-[#E2E8F0] last:border-0">
                  <div className="h-4 bg-[#E2E8F0] rounded animate-pulse" />
                </div>
              ))
            ) : departments.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-[#94A3B8]">No departments yet.</p>
                <p className="text-xs text-[#CBD5E1] mt-1">Go back to step 3 to add departments.</p>
              </div>
            ) : (
              departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDeptId(dept.id)}
                  className={[
                    'flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] last:border-0 text-left transition-colors',
                    selectedDeptId === dept.id
                      ? 'bg-[#EFF6FF] text-[#2563EB]'
                      : 'text-[#475569] hover:bg-[#F8FAFC]',
                  ].join(' ')}
                >
                  <span className="text-sm font-medium">{dept.name}</span>
                  {selectedDeptId === dept.id && <ChevronRight size={14} />}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Roles panel */}
        <div className="flex-1 bg-white border border-[#E2E8F0] rounded-[12px] flex flex-col overflow-hidden">
          {!selectedDeptId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
              <Briefcase size={28} className="text-[#CBD5E1]" />
              <p className="text-sm text-[#94A3B8]">Select a department to manage its roles.</p>
            </div>
          ) : (
            <>
              {/* Dept header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="font-bold text-[#0F172A]">{selectedDept?.name}</h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{roles.length} role{roles.length !== 1 ? 's' : ''}</p>
                </div>
                {!showAddForm && (
                  <Button variant="primary" size="sm" onClick={() => setShowAddForm(true)}>
                    <Plus size={14} /> Add Role
                  </Button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {showAddForm && (
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-5">
                    <h4 className="font-semibold text-[#0F172A] mb-4">New Role</h4>
                    <AddRoleForm
                      deptId={selectedDeptId}
                      orgId={orgId}
                      onSaved={() => { setShowAddForm(false); loadRoles() }}
                      onCancel={() => setShowAddForm(false)}
                    />
                  </div>
                )}

                {isLoadingRoles ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-24 bg-[#E2E8F0] rounded-[10px] animate-pulse" />
                  ))
                ) : roles.length === 0 && !showAddForm ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <Briefcase size={28} className="text-[#CBD5E1]" />
                    <p className="text-sm text-[#94A3B8]">No roles in this department yet.</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="text-sm text-[#2563EB] font-medium hover:text-[#1D4ED8]"
                    >
                      Add the first role
                    </button>
                  </div>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      className="bg-white border border-[#E2E8F0] rounded-[10px] p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm text-[#0F172A]">{role.title}</h4>
                            <span
                              className={[
                                'inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                                levelColors[role.level],
                              ].join(' ')}
                            >
                              {role.level}
                            </span>
                          </div>
                          {role.job_description && (
                            <p className="text-xs text-[#475569] mt-1.5 line-clamp-2">
                              {role.job_description}
                            </p>
                          )}
                          <div className="flex gap-3 mt-2">
                            {role.kra && role.kra.length > 0 && (
                              <span className="text-xs text-[#94A3B8]">
                                {role.kra.length} KRA{role.kra.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {role.kpi && role.kpi.length > 0 && (
                              <span className="text-xs text-[#94A3B8]">
                                {role.kpi.length} KPI{role.kpi.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => router.push('/setup/step-3-org-chart')}>
          Back
        </Button>
        <Button variant="primary" onClick={() => router.push('/setup/step-5-employees')}>
          Continue
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  )
}
