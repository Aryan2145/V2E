'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getDepartments } from '@/lib/api/departments'
import DeptRolesPanel from '@/components/roles/DeptRolesPanel'
import type { Department } from '@/lib/types'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const canEdit = !!user?.is_admin

  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    getDepartments(orgId)
      .catch(() => [])
      .then((d) => setDepartments(d))
      .finally(() => setLoading(false))
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Roles</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Roles grouped by department. Select a department to view, add, or edit its roles.
        </p>
      </div>

      <DeptRolesPanel departments={departments} orgId={orgId} canEdit={canEdit} />
    </div>
  )
}
