'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { getOrgIdentity } from '@/lib/api/org-identity'
import Button from '@/components/ui/Button'
import type { OrgIdentity } from '@/lib/types'
import { Building2, Pencil, Star } from 'lucide-react'

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, content }: { title: string; content?: string }) {
  if (!content) return null
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
      <h2 className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-3">
        {title}
      </h2>
      <p className="text-[#1E293B] leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        <Building2 size={28} className="text-[#94A3B8]" />
      </div>
      <h2 className="text-lg font-semibold text-[#0F172A]">No identity defined yet</h2>
      <p className="text-[#475569] text-sm mt-1 max-w-xs">
        Define your organization&apos;s philosophy, vision, mission, purpose and values.
      </p>
      {canEdit && (
        <Link href="/setup/step-1-identity" className="mt-5">
          <Button>Define identity</Button>
        </Link>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IdentityPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const canEdit = !!user?.is_admin

  const [identity, setIdentity] = useState<OrgIdentity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    getOrgIdentity(orgId)
      .then(setIdentity)
      .catch(() => setIdentity(null))
      .finally(() => setLoading(false))
  }, [orgId])

  const hasContent =
    identity &&
    (identity.philosophy || identity.vision || identity.mission || identity.purpose)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">
            Organization Identity
          </h1>
          <p className="mt-1 text-[15px] text-[#475569]">
            Your company&apos;s philosophy, vision, mission, purpose and core values.
          </p>
        </div>
        {canEdit && hasContent && (
          <Link href="/setup/step-1-identity">
            <Button variant="secondary" size="sm">
              <Pencil size={14} />
              Edit
            </Button>
          </Link>
        )}
      </div>

      {!hasContent ? (
        <EmptyState canEdit={canEdit} />
      ) : (
        <>
          {/* Core sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="Philosophy" content={identity?.philosophy} />
            <Section title="Vision" content={identity?.vision} />
            <Section title="Mission" content={identity?.mission} />
            <Section title="Purpose" content={identity?.purpose} />
          </div>

          {/* Values */}
          {identity?.values && identity.values.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                <Star size={18} className="text-[#CA8A04]" />
                Core Values
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {identity.values.map((v, i) => (
                  <div
                    key={i}
                    className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#FEF9C3] flex items-center justify-center mb-3">
                      <Star size={14} className="text-[#CA8A04]" />
                    </div>
                    <h3 className="font-bold text-[#0F172A] text-sm">{v.title}</h3>
                    {v.description && (
                      <p className="text-[#475569] text-xs mt-1.5 leading-relaxed">
                        {v.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
