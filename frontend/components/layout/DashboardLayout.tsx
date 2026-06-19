'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import Sidebar, { type SidebarRole } from './Sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  sidebarRole?: SidebarRole
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  sidebarRole,
}: DashboardLayoutProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the mobile nav drawer whenever the route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  const role: SidebarRole = sidebarRole ?? (
    user?.isSuperAdmin ? 'super_admin' : user?.is_admin ? 'admin' : 'member'
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar role={role} mobileOpen={drawerOpen} onMobileClose={() => setDrawerOpen(false)} />

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="ml-0 md:ml-[240px] min-h-screen flex flex-col">
        {/* Mobile top bar with hamburger — sidebar is off-canvas below md */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-4 bg-white border-b border-[#E2E8F0]">
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={drawerOpen}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-[8px] text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="text-[#0F172A] font-bold text-lg tracking-tight select-none">V2E</span>
        </div>

        {title && (
          <header className="px-4 sm:px-6 md:px-8 pt-6 md:pt-8 pb-4">
            <h1 className="text-[22px] md:text-[28px] font-bold text-[#0F172A] leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-[15px] text-[#475569]">{subtitle}</p>
            )}
          </header>
        )}

        <div className="flex-1 px-4 sm:px-6 md:px-8 pb-8">{children}</div>
      </main>
    </div>
  )
}
