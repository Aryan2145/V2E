'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import SetupSidebar from '@/components/setup-wizard/SetupSidebar'
import type { SetupStep } from '@/components/setup-wizard/SetupSidebar'

// ─── Setup steps definition ────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Company Identity', href: '/setup/step-1-identity' },
  { id: 2, label: 'Culture', href: '/setup/step-2-culture' },
  { id: 3, label: 'Org Structure', href: '/setup/step-3-org-chart' },
  { id: 4, label: 'Roles & JDs', href: '/setup/step-4-roles' },
  { id: 5, label: 'Employees', href: '/setup/step-5-employees' },
]

// ─── Derive current step from pathname ────────────────────────────────────────

function deriveStep(pathname: string): number {
  const match = STEPS.find((s) => pathname.startsWith(s.href))
  return match?.id ?? 1
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && (!user || !['org_admin', 'hr_manager'].includes(user.role))) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  const currentStep = deriveStep(pathname)

  const steps: SetupStep[] = useMemo(
    () =>
      STEPS.map((s) => ({
        ...s,
        completed: s.id < currentStep,
      })),
    [currentStep]
  )

  const progressPercent = Math.round(((currentStep - 1) / STEPS.length) * 100)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="h-8 w-8 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user || !['org_admin', 'hr_manager'].includes(user.role)) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      {/* Top header bar */}
      <header className="bg-white border-b border-[#E2E8F0] h-14 flex items-center px-6 gap-6 shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronLeft size={15} />
            Dashboard
          </Link>
          <span className="text-[#E2E8F0]">|</span>
          <span className="font-bold text-[#0F172A] text-base">OrgOS Setup</span>
          {user.organization_id && (
            <span className="text-sm text-[#64748B]">— {user.name}</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-[#475569] shrink-0">
            {progressPercent}% complete
          </span>
        </div>

        <span className="text-xs text-[#64748B] shrink-0">
          Step {currentStep} of {STEPS.length}
        </span>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar — fixed height within the body */}
        <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
          <SetupSidebar currentStep={currentStep} steps={steps} />
        </div>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-3xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
