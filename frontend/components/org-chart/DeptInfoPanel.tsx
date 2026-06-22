'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X, UserCircle2, Users, Network, ChevronRight, Pencil } from 'lucide-react'
import type { Department, EmployeeProfile } from '@/lib/types'

interface DeptInfoPanelProps {
  department: Department | null
  /** Branch/override hue for this department (small accent dot). */
  accentColor?: string
  /** Ancestor chain, root → immediate parent, for breadcrumb back-navigation. */
  ancestors: Department[]
  members: EmployeeProfile[]
  subDepartments: Department[]
  canEdit: boolean
  onEdit: (dept: Department) => void
  onSelectDepartment: (dept: Department) => void
  onClose: () => void
}

/**
 * Read-only detail drawer for a department: head, members (name + role) and
 * sub-departments. Slides in from the right; click a member to open their
 * profile, click a sub-department to drill into it.
 */
export default function DeptInfoPanel({
  department,
  accentColor,
  ancestors,
  members,
  subDepartments,
  canEdit,
  onEdit,
  onSelectDepartment,
  onClose,
}: DeptInfoPanelProps) {
  const router = useRouter()
  const open = !!department

  // Portal to <body> so the drawer is never clipped by the fixed top nav.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />}

      <div
        className={`fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-white border-l border-[#E2E8F0] shadow-[-8px_0_32px_rgba(0,0,0,0.08)] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {department && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E2E8F0]">
              <div className="min-w-0">
                {ancestors.length > 0 && (
                  <nav className="flex items-center flex-wrap gap-0.5 mb-1 text-xs text-[#64748B]">
                    {ancestors.map((a) => (
                      <span key={a.id} className="flex items-center gap-0.5">
                        <button
                          onClick={() => onSelectDepartment(a)}
                          className="hover:text-[#2563EB] hover:underline font-medium truncate max-w-[120px]"
                        >
                          {a.name}
                        </button>
                        <ChevronRight size={11} className="text-[#CBD5E1]" />
                      </span>
                    ))}
                  </nav>
                )}
                <h3 className="font-bold text-[#0F172A] text-[17px] truncate flex items-center gap-2">
                  {accentColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                  {department.name}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {department._count?.employee_profiles ?? members.length} members ·{' '}
                  {department._count?.roles ?? 0} roles ·{' '}
                  {department._count?.child_departments ?? subDepartments.length} sub-departments
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <button
                    onClick={() => onEdit(department)}
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                    aria-label="Edit department"
                  >
                    <Pencil size={15} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
              {department.description && (
                <p className="text-sm text-[#475569] leading-relaxed">{department.description}</p>
              )}

              {/* Department head */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                  Department Head
                </h4>
                {department.head_user?.name ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] text-sm font-bold shrink-0">
                      {department.head_user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-[#0F172A]">
                      {department.head_user.name}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-[#94A3B8] flex items-center gap-1.5">
                    <UserCircle2 size={15} /> No head assigned
                  </p>
                )}
              </section>

              {/* Members */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2 flex items-center gap-1.5">
                  <Users size={13} /> Members ({members.length})
                </h4>
                {members.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">No one is in this department yet.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => router.push(`/settings/organization/employees/${m.id}`)}
                        className="group flex items-center gap-2.5 rounded-[8px] px-2 py-2 text-left hover:bg-[#F8FAFC] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#475569] text-xs font-semibold shrink-0">
                          {(m.user?.name ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#0F172A] truncate">
                            {m.user?.name ?? '—'}
                          </p>
                          <p className="text-xs text-[#64748B] truncate">{m.role?.title ?? ''}</p>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-[#CBD5E1] group-hover:text-[#94A3B8] shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Sub-departments */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2 flex items-center gap-1.5">
                  <Network size={13} /> Sub-departments ({subDepartments.length})
                </h4>
                {subDepartments.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">No sub-departments.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {subDepartments.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => onSelectDepartment(d)}
                        className="group flex items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-left bg-[#F8FAFC] hover:bg-[#EFF6FF] transition-colors"
                      >
                        <span className="text-sm font-medium text-[#0F172A] truncate">{d.name}</span>
                        <span className="text-xs text-[#64748B] shrink-0">
                          {d._count?.employee_profiles ?? 0} ·{' '}
                          <ChevronRight size={12} className="inline" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}
