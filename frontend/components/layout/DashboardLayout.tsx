'use client'

import React from 'react'
import { useAuth } from '@/lib/auth/context'
import type { UserRole } from '@/lib/types'
import Sidebar from './Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  sidebarRole?: UserRole
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  sidebarRole,
}: DashboardLayoutProps) {
  const { user } = useAuth()

  const role: UserRole = sidebarRole ?? (
    user?.isSuperAdmin ? 'super_admin' : user?.role ?? 'employee'
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar role={role} />

      <main className="ml-[240px] min-h-screen flex flex-col">
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

        <div className="flex-1 px-8 pb-8">{children}</div>
      </main>
    </div>
  )
}
