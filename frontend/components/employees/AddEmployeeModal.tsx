'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Eye, EyeOff, Loader2, Plus } from 'lucide-react'
import { createEmployee } from '@/lib/api/employees'
import { getUsers } from '@/lib/api/users'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth/context'
import { usePermissions } from '@/lib/auth/use-permissions'
import DeptFormDrawer from '@/components/org-chart/DeptFormDrawer'
import RoleFormDrawer from '@/components/roles/RoleFormDrawer'
import type { Department, Role, User, EmployeeProfile, EmploymentType } from '@/lib/types'

const STRUCTURE_LEAF = 'settings.organization.structure'

interface Props {
  orgId: string
  departments: Department[]
  roles: Role[]
  employees: EmployeeProfile[]
  onClose: () => void
  onCreated: () => void
}

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
]

const inputClass =
  'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
const labelClass = 'block text-sm font-medium text-[#374151] mb-1'

export default function AddEmployeeModal({
  orgId,
  departments,
  roles,
  employees,
  onClose,
  onCreated,
}: Props) {
  const { addToast } = useToast()
  const { user } = useAuth()
  const { can } = usePermissions()
  // Role create is @RequireAdmin; department create is the structure-write permission.
  const canCreateRole = !!user?.is_admin
  const canCreateDept = can(STRUCTURE_LEAF, 'write')

  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // Roles can be created inline via the role drawer, so keep a local copy we can
  // append to.
  const [localRoles, setLocalRoles] = useState<Role[]>(roles)
  const [creatingRole, setCreatingRole] = useState(false)

  // Departments can be created inline via the org-chart drawer (kept in flow,
  // so the user never has to leave the form). Keep a local, appendable copy.
  const [localDepartments, setLocalDepartments] = useState<Department[]>(departments)
  const [creatingDept, setCreatingDept] = useState(false)
  const [users, setUsers] = useState<User[]>([])

  // The dept drawer needs the user list for its "head" picker; load it lazily
  // only when the current user can actually create departments.
  useEffect(() => {
    if (!orgId || !canCreateDept) return
    getUsers(orgId)
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [orgId, canCreateDept])

  // Portal to <body> so the overlay isn't constrained by the dashboard layout's
  // stacking context, and lock background scroll while open.
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department_id: '',
    role_id: '',
    employment_type: 'full_time' as EmploymentType,
    employee_code: '',
    reporting_to_user_id: '',
    date_of_joining: '',
    date_of_birth: '',
    marriage_date: '',
  })

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Roles are scoped to the chosen department.
  const deptRoles = useMemo(
    () => localRoles.filter((r) => r.department_id === form.department_id),
    [localRoles, form.department_id],
  )


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email and password are required.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!form.department_id || !form.role_id) {
      setError('Please select a department and role.')
      return
    }

    setSaving(true)
    try {
      await createEmployee(orgId, {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: form.role_id,
        department_id: form.department_id,
        employment_type: form.employment_type,
        reporting_to_user_id: form.reporting_to_user_id || undefined,
        employee_code: form.employee_code.trim() || undefined,
        date_of_joining: form.date_of_joining || undefined,
        date_of_birth: form.date_of_birth || undefined,
        marriage_date: form.marriage_date || undefined,
      })
      addToast(`${form.name.trim()} added`, 'success')
      onCreated()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? 'Failed to add employee. Please try again.'
      setError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-[12px] rounded-t-[16px] shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Add Employee</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] text-sm text-[#DC2626]">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Full name *</label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Jane Doe"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="jane@company.com"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="Min. 8 characters"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Employee code</label>
                <input
                  value={form.employee_code}
                  onChange={(e) => set('employee_code', e.target.value)}
                  placeholder="EMP-001"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Department *</label>
                <select
                  value={form.department_id}
                  onChange={(e) => {
                    set('department_id', e.target.value)
                    set('role_id', '') // reset role when department changes
                    setCreatingRole(false) // roles are dept-scoped
                  }}
                  className={inputClass}
                >
                  <option value="">Select department…</option>
                  {localDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {canCreateDept && (
                  <button
                    type="button"
                    onClick={() => setCreatingDept(true)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <Plus size={12} /> New department
                  </button>
                )}
              </div>
              <div>
                <label className={labelClass}>Role *</label>
                <select
                  value={form.role_id}
                  onChange={(e) => set('role_id', e.target.value)}
                  disabled={!form.department_id}
                  className={`${inputClass} disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]`}
                >
                  <option value="">
                    {form.department_id ? 'Select role…' : 'Pick a department first'}
                  </option>
                  {deptRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>

                {/* Inline role creation — opens the full role drawer over this
                    modal, scoped to the chosen department (admin only) */}
                {canCreateRole && form.department_id && (
                  <button
                    type="button"
                    onClick={() => setCreatingRole(true)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <Plus size={12} /> New role
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Employment type</label>
                <select
                  value={form.employment_type}
                  onChange={(e) => set('employment_type', e.target.value)}
                  className={inputClass}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Reports to</label>
                <select
                  value={form.reporting_to_user_id}
                  onChange={(e) => set('reporting_to_user_id', e.target.value)}
                  className={inputClass}
                >
                  <option value="">No manager</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.user_id}>
                      {emp.user?.name ?? 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Date of joining</label>
                <input
                  type="date"
                  value={form.date_of_joining}
                  onChange={(e) => set('date_of_joining', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Date of birth</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Marriage date</label>
                <input
                  type="date"
                  value={form.marriage_date}
                  onChange={(e) => set('marriage_date', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Adding…' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>

      {/* Inline department creation — opens over this modal, keeping the user in flow */}
      {canCreateDept && (
        <DeptFormDrawer
          target={creatingDept ? { mode: 'create' } : null}
          departments={localDepartments}
          users={users}
          orgId={orgId}
          onClose={() => setCreatingDept(false)}
          onSaved={(saved) => {
            setLocalDepartments((ds) => [...ds, saved])
            set('department_id', saved.id) // auto-select the new department
            set('role_id', '') // its role list is empty until one is added
            setCreatingRole(false)
            setCreatingDept(false)
            addToast(`Department "${saved.name}" created`, 'success')
          }}
        />
      )}

      {/* Inline role creation — full role form (level, JD, KRAs, KPIs) over this
          modal, scoped to the selected department */}
      {canCreateRole && (
        <RoleFormDrawer
          target={
            creatingRole && form.department_id
              ? { mode: 'create', deptId: form.department_id }
              : null
          }
          orgId={orgId}
          onClose={() => setCreatingRole(false)}
          onSaved={(saved) => {
            setLocalRoles((rs) => [...rs, saved])
            set('role_id', saved.id) // auto-select the new role
            setCreatingRole(false)
            addToast(`Role "${saved.title}" created`, 'success')
          }}
        />
      )}
    </div>,
    document.body,
  )
}
