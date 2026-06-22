'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { getDepartments } from '@/lib/api/departments'
import { useAuth } from '@/lib/auth/context'
import { useSetupMode, SECTION_SETTINGS_ROUTE } from '@/components/setup-wizard/SetupModeContext'
import DeptRolesPanel from '@/components/roles/DeptRolesPanel'
import Button from '@/components/ui/Button'
import type { Department } from '@/lib/types'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step4RolesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const mode = useSetupMode()
  const isEdit = mode === 'edit'
  const orgId = user?.organizationId ?? ''

  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoadingDepts, setIsLoadingDepts] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setIsLoadingDepts(false)
      return
    }
    getDepartments(orgId)
      .catch(() => [])
      .then((data) => setDepartments(data))
      .finally(() => setIsLoadingDepts(false))
  }, [orgId])

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        {!isEdit && (
          <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">
            Step 4 of 5
          </p>
        )}
        <h1 className="text-[26px] font-bold text-[#0F172A]">Roles &amp; Job Descriptions</h1>
        <p className="text-sm text-[#475569] mt-1">
          Define roles within each department along with their job descriptions, KRAs, and KPIs.
          Select a department on the left, then add a role or click an existing one to edit it.
        </p>
      </div>

      {isLoadingDepts ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DeptRolesPanel departments={departments} orgId={orgId} canEdit />
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {isEdit ? (
          <Button variant="secondary" onClick={() => router.push(SECTION_SETTINGS_ROUTE[4])}>
            <ArrowLeft size={15} />
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => router.push('/setup/step-3-org-chart')}>
              Back
            </Button>
            <Button variant="primary" onClick={() => router.push('/setup/step-5-employees')}>
              Continue
              <ArrowRight size={15} />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
