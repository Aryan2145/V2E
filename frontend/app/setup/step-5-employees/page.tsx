'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle2, Users, ArrowLeft } from 'lucide-react'
import { getDepartments } from '@/lib/api/departments'
import { getRoles } from '@/lib/api/roles'
import { getEmployees, createEmployee } from '@/lib/api/employees'
import { useAuth } from '@/lib/auth/context'
import { useSetupMode, SECTION_SETTINGS_ROUTE } from '@/components/setup-wizard/SetupModeContext'
import Button from '@/components/ui/Button'
import type { Department, Role, EmployeeProfile } from '@/lib/types'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department_id: z.string().min(1, 'Select a department'),
  role_id: z.string().min(1, 'Select a role'),
  reporting_to_user_id: z.string().optional(),
  make_dep_head: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors'
const labelCls = 'text-sm font-medium text-[#374151] mb-1.5 block'

// ─── Employee tree ─────────────────────────────────────────────────────────────

interface TreeNodeProps {
  employee: EmployeeProfile
  allEmployees: EmployeeProfile[]
  depth: number
}

function TreeNode({ employee, allEmployees, depth }: TreeNodeProps) {
  const reports = allEmployees.filter(
    (e) => e.reporting_to_user_id === employee.user_id
  )

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-[#E2E8F0] pl-4' : ''}>
      <div className="flex items-center gap-2 py-2">
        <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-xs font-bold shrink-0">
          {(employee.user?.name ?? 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A] truncate">
            {employee.user?.name ?? '—'}
          </p>
          <p className="text-xs text-[#94A3B8] truncate">
            {employee.role?.title ?? ''} · {employee.department?.name ?? ''}
          </p>
        </div>
      </div>
      {reports.map((r) => (
        <TreeNode key={r.id} employee={r} allEmployees={allEmployees} depth={depth + 1} />
      ))}
    </div>
  )
}

function ReportingTree({ employees }: { employees: EmployeeProfile[] }) {
  const roots = employees.filter((e) => !e.reporting_to_user_id)

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center">
          <Users size={22} className="text-[#94A3B8]" />
        </div>
        <p className="text-sm text-[#94A3B8] text-center">
          No employees added yet.<br />Fill the form to add your first employee.
        </p>
      </div>
    )
  }

  return (
    <div className="py-2">
      {roots.map((emp) => (
        <TreeNode key={emp.id} employee={emp} allEmployees={employees} depth={0} />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step5EmployeesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const mode = useSetupMode()
  const isEdit = mode === 'edit'
  const orgId = user?.organizationId ?? ''

  const [departments, setDepartments] = useState<Department[]>([])
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { department_id: '', role_id: '', reporting_to_user_id: '' },
  })

  const watchedDeptId = watch('department_id')

  // Load initial data
  const loadData = useCallback(async () => {
    if (!orgId) return
    try {
      const [depts, roles, emps] = await Promise.all([
        getDepartments(orgId),
        getRoles(orgId),
        getEmployees(orgId),
      ])
      setDepartments(depts)
      setAllRoles(roles)
      setEmployees(emps)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter roles when department changes
  useEffect(() => {
    if (watchedDeptId) {
      setFilteredRoles(allRoles.filter((r) => r.department_id === watchedDeptId))
      setValue('role_id', '')
    } else {
      setFilteredRoles([])
    }
  }, [watchedDeptId, allRoles, setValue])

  const onSubmit = async (data: FormValues) => {
    if (!orgId) return
    setServerError(null)
    setSuccessMsg(null)
    try {
      await createEmployee(orgId, {
        name: data.name,
        email: data.email,
        password: data.password,
        role_id: data.role_id,
        department_id: data.department_id,
        employment_type: 'full_time',
        reporting_to_user_id: data.reporting_to_user_id || undefined,
        make_dep_head: data.make_dep_head || undefined,
      })
      setSuccessMsg(`${data.name} added successfully!`)
      reset({ department_id: '', role_id: '', reporting_to_user_id: '', make_dep_head: false })
      await loadData()
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Failed to add employee.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        {!isEdit && (
          <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">Step 5 of 5</p>
        )}
        <h1 className="text-[26px] font-bold text-[#0F172A]">Employee Profiles</h1>
        <p className="text-sm text-[#475569] mt-1">
          Add employees, assign them to roles and departments, and build your reporting hierarchy.
        </p>
      </div>

      <div className="flex gap-5">
        {/* Left: Add employee form */}
        <div className="flex-1 bg-white border border-[#E2E8F0] rounded-[12px] p-6 flex flex-col gap-5">
          <h2 className="text-[15px] font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-4">
            Add Employee
          </h2>

          {successMsg && (
            <div className="flex items-center gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] px-3 py-2.5">
              <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
              <p className="text-sm text-[#166534] font-medium">{successMsg}</p>
            </div>
          )}

          {serverError && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] px-3 py-2.5 text-sm text-[#DC2626]">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Name + Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Full Name *</label>
                <input
                  {...register('name')}
                  placeholder="Jane Smith"
                  className={inputCls}
                />
                {errors.name && <p className="text-xs text-[#DC2626] mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="jane@company.com"
                  className={inputCls}
                />
                {errors.email && <p className="text-xs text-[#DC2626] mt-1">{errors.email.message}</p>}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Password *</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  className={[inputCls, 'pr-10'].join(' ')}
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
              {errors.password && <p className="text-xs text-[#DC2626] mt-1">{errors.password.message}</p>}
            </div>

            {/* Department */}
            <div>
              <label className={labelCls}>Department *</label>
              <select {...register('department_id')} className={inputCls}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {errors.department_id && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.department_id.message}</p>
              )}
              {(() => {
                const selectedDept = departments.find((d) => d.id === watchedDeptId)
                const showHeadOption = selectedDept ? !selectedDept.head_user_id : false
                if (!showHeadOption) return null
                return (
                  <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      {...register('make_dep_head')}
                      className="w-4.5 h-4.5 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="text-xs font-medium text-[#475569]">
                      Make this employee the Head of this department
                    </span>
                  </label>
                )
              })()}
            </div>

            {/* Role — filtered by dept */}
            <div>
              <label className={labelCls}>Role *</label>
              <select
                {...register('role_id')}
                className={inputCls}
                disabled={!watchedDeptId}
              >
                <option value="">
                  {watchedDeptId ? 'Select role' : 'Select a department first'}
                </option>
                {filteredRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.level})
                  </option>
                ))}
              </select>
              {errors.role_id && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.role_id.message}</p>
              )}
            </div>

            {/* Reporting to */}
            <div>
              <label className={labelCls}>Reporting To</label>
              <select {...register('reporting_to_user_id')} className={inputCls}>
                <option value="">No direct manager</option>
                {employees.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.user?.name ?? e.user_id} — {e.role?.title ?? ''}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Add Employee
            </Button>
          </form>
        </div>

        {/* Right: Reporting tree */}
        <div className="w-[300px] shrink-0 bg-white border border-[#E2E8F0] rounded-[12px] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#0F172A]">Reporting Tree</h2>
            <span className="text-xs text-[#94A3B8]">{employees.length} employees</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex flex-col gap-3 py-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#E2E8F0] animate-pulse shrink-0" />
                    <div className="flex-1 h-4 rounded bg-[#E2E8F0] animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <ReportingTree employees={employees} />
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {isEdit ? (
          <Button variant="secondary" onClick={() => router.push(SECTION_SETTINGS_ROUTE[5])}>
            <ArrowLeft size={15} />
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => router.push('/setup/step-4-roles')}>
              Back
            </Button>
            <Button variant="primary" onClick={() => router.push('/dashboard')}>
              Complete Setup
              <CheckCircle2 size={15} />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
