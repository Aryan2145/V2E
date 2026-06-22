'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import type { SetupMode } from './SetupModeContext'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SetupStep {
  id: number
  label: string
  completed: boolean
  href: string
}

interface SetupSidebarProps {
  currentStep: number
  steps: SetupStep[]
  mode?: SetupMode
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SetupSidebar({ currentStep, steps, mode = 'setup' }: SetupSidebarProps) {
  const isEdit = mode === 'edit'

  return (
    <aside className="w-[280px] shrink-0 bg-white border-r border-[#E2E8F0] h-full flex flex-col">
      {/* Brand header */}
      <div className="px-6 pt-6 pb-5 border-b border-[#E2E8F0]">
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-widest mb-1">
          {isEdit ? 'Organization' : 'Setup Wizard'}
        </p>
        <h2 className="text-[18px] font-bold text-[#0F172A]">{isEdit ? 'Edit Sections' : 'V2E'}</h2>
      </div>

      {/* Steps */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1">
        {steps.map((step) => {
          const isActive = step.id === currentStep

          // Edit mode: a free menu — every section is directly clickable, in any
          // order, with no forced sequence and no completion checkmarks.
          if (isEdit) {
            return (
              <Link
                key={step.id}
                href={step.href}
                className={[
                  'group flex items-center gap-3 rounded-[10px] px-3 py-3 transition-colors duration-150',
                  isActive ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]',
                ].join(' ')}
              >
                <div
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'bg-[#F1F5F9] border-2 border-[#CBD5E1] text-[#64748B]',
                  ].join(' ')}
                >
                  <span className="text-xs font-bold">{step.id}</span>
                </div>
                <span
                  className={[
                    'text-sm leading-tight',
                    isActive ? 'font-bold text-[#0F172A]' : 'font-medium text-[#475569]',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </Link>
            )
          }

          // Setup mode — unchanged: sequential journey with completed checkmarks.
          const isCompleted = step.completed

          return (
            <Link
              key={step.id}
              href={step.href}
              className={[
                'group flex items-center gap-3 rounded-[10px] px-3 py-3 transition-colors duration-150',
                isActive
                  ? 'bg-[#EFF6FF] cursor-default'
                  : isCompleted
                  ? 'hover:bg-[#F8FAFC]'
                  : 'hover:bg-[#F8FAFC] cursor-pointer',
              ].join(' ')}
            >
              {/* Step indicator */}
              {isCompleted ? (
                <div className="w-7 h-7 rounded-full bg-[#DCFCE7] border-2 border-[#16A34A] flex items-center justify-center shrink-0">
                  <Check size={13} className="text-[#16A34A]" strokeWidth={2.5} />
                </div>
              ) : isActive ? (
                <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white text-xs font-bold">{step.id}</span>
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#F1F5F9] border-2 border-[#CBD5E1] flex items-center justify-center shrink-0">
                  <span className="text-[#64748B] text-xs font-semibold">{step.id}</span>
                </div>
              )}

              {/* Label */}
              <span
                className={[
                  'text-sm leading-tight',
                  isActive
                    ? 'font-bold text-[#0F172A]'
                    : isCompleted
                    ? 'font-medium text-[#475569]'
                    : 'font-medium text-[#64748B]',
                ].join(' ')}
              >
                {step.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[#E2E8F0]">
        <p className="text-xs text-[#64748B]">
          {isEdit
            ? 'Select any section to edit it. Changes save per section.'
            : 'Complete all steps to finish your organization setup.'}
        </p>
      </div>
    </aside>
  )
}
