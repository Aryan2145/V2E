'use client'

import React from 'react'
import { useAuth } from '@/lib/auth/context'
import type { UserRole } from '@/lib/types'
import Sidebar from './Sidebar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  /** Override role for sidebar (defaults to authenticated user's role) */
  sidebarRole?: UserRole
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
  title,
  subtitle,
  sidebarRole,
}: DashboardLayoutProps) {
  const { user } = useAuth()

  const role: UserRole = sidebarRole ?? user?.role ?? 'employee'

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Fixed left sidebar */}
      <Sidebar role={role} />

      {/* Main content — offset by sidebar width */}
      <main className="ml-[240px] min-h-screen flex flex-col">
        {/* Page header — only rendered when a title is provided */}
        {title && (
          <header className="px-8 pt-8 pb-4">
            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-[15px] text-[#475569]">{subtitle}</p>
            )}
          </header>
        )}

        {/* Page body */}
        <div className="flex-1 px-8 pb-8">{children}</div>
      </main>
    </div>
  )
}
