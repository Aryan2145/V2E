'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Foundation', href: '/foundation' },
  { label: 'Goals', href: '/goals' },
  { label: 'Learning', href: '/learning' },
  { label: 'Communication', href: '/communication' },
]

export default function TopNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
    return pathname.startsWith(href)
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#E2E8F0] flex items-center z-50">
      {/* Brand */}
      <div className="w-[200px] shrink-0 px-6">
        <span className="text-[#0F172A] font-bold text-lg tracking-tight select-none">OrgOS</span>
      </div>

      {/* Nav tabs */}
      <nav className="flex items-stretch flex-1 h-full">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'relative px-5 flex items-center text-sm font-medium transition-colors duration-150',
                active
                  ? 'text-[#2563EB]'
                  : 'text-[#64748B] hover:text-[#0F172A]',
              ].join(' ')}
            >
              {item.label}
              {active && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#2563EB] rounded-t-full" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      {user && (
        <div className="flex items-center gap-3 px-6 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-[#0F172A] leading-tight">{user.name}</p>
            <p className="text-xs text-[#64748B] capitalize leading-tight">
              {user.role.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
