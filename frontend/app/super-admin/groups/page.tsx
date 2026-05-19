'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, ArrowRight, Plus, Building2 } from 'lucide-react'
import { getGroups } from '@/lib/api/groups'
import Button from '@/components/ui/Button'
import type { OrganizationGroup } from '@/lib/types'

function SkeletonRow() {
  return (
    <tr className="border-b border-[#E2E8F0]">
      {[180, 80, 60, 60].map((w, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 rounded-md bg-[#E2E8F0] animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<OrganizationGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGroups()
      .then((d) => { if (!cancelled) setGroups(d) })
      .catch(() => { if (!cancelled) setError('Failed to load groups.') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Groups</h1>
          <p className="text-sm text-[#475569] mt-1">Manage organization groups — cluster related companies and share users across them.</p>
        </div>
        <Button variant="primary" onClick={() => router.push('/super-admin/groups/new')}>
          <Plus size={16} />
          New Group
        </Button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {['Name', 'Slug', 'Organizations', 'Actions'].map((col) => (
                <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}

            {!isLoading && error && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-[#DC2626] text-sm">{error}</td></tr>
            )}

            {!isLoading && !error && groups.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="flex flex-col items-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center">
                      <Layers size={22} className="text-[#94A3B8]" />
                    </div>
                    <p className="text-[#475569] font-medium">No groups yet</p>
                    <p className="text-[#94A3B8] text-xs">Click "New Group" to create your first organization group.</p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !error && groups.map((g) => (
              <tr key={g.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center shrink-0">
                      <Layers size={16} className="text-[#2563EB]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#0F172A]">{g.name}</p>
                      {g.description && <p className="text-xs text-[#475569] mt-0.5">{g.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#475569] font-mono text-xs">{g.slug}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-[#475569]">
                    <Building2 size={14} />
                    <span>{g._count?.organizations ?? g.organizations?.length ?? 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => router.push(`/super-admin/groups/${g.id}`)}
                    className="inline-flex items-center gap-1 text-[#2563EB] text-sm font-medium hover:text-[#1D4ED8] transition-colors"
                  >
                    View <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
