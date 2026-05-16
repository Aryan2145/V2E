'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getAnnouncement, markAnnouncementRead, getReadStatus } from '@/lib/api/announcements'
import type { Announcement } from '@/lib/types/communication'
import Link from 'next/link'
import { ArrowLeft, Pin, Users } from 'lucide-react'

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-[#FEE2E2] text-[#DC2626]',
  high: 'bg-[#FEF3C7] text-[#D97706]',
  normal: 'bg-[#F1F5F9] text-[#475569]',
}

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const orgId = user?.organization_id ?? ''
  const isHR = user?.role === 'org_admin' || user?.role === 'hr_manager'
  const [ann, setAnn] = useState<Announcement | null>(null)
  const [readStatus, setReadStatus] = useState<{ total_employees: number; read_count: number; reads: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReads, setShowReads] = useState(false)

  useEffect(() => {
    if (!orgId || !id) return
    Promise.all([
      getAnnouncement(orgId, id),
      isHR ? getReadStatus(orgId, id) : Promise.resolve(null),
    ]).then(([a, rs]) => {
      setAnn(a)
      setReadStatus(rs)
      if (a && (!a.reads || a.reads.length === 0)) {
        markAnnouncementRead(orgId, id)
      }
    }).finally(() => setLoading(false))
  }, [orgId, id, isHR])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!ann) return null

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/communication/announcements"
          className="flex items-center gap-2 text-sm text-[#475569] hover:text-[#0F172A] mb-6 w-fit"
        >
          <ArrowLeft size={16} />
          Back to Announcements
        </Link>

        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[ann.priority] ?? PRIORITY_BADGE.normal}`}>
              {ann.priority.toUpperCase()}
            </span>
            <span className="text-xs bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-full capitalize">{ann.type}</span>
            {ann.is_pinned && <Pin size={12} className="text-[#2563EB]" />}
          </div>

          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">{ann.title}</h1>

          <div className="flex items-center gap-3 text-xs text-[#94A3B8] mb-6">
            <span>By {ann.created_by?.name}</span>
            <span>·</span>
            <span>{new Date(ann.published_at ?? ann.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          <div className="text-sm text-[#1E293B] leading-relaxed whitespace-pre-wrap border-t border-[#F1F5F9] pt-5">
            {ann.body}
          </div>

          {isHR && readStatus && (
            <div className="mt-8 border-t border-[#F1F5F9] pt-5">
              <button
                onClick={() => setShowReads(s => !s)}
                className="flex items-center gap-2 text-sm font-semibold text-[#475569] hover:text-[#0F172A] transition-colors"
              >
                <Users size={16} />
                Read by {readStatus.read_count} / {readStatus.total_employees} employees
              </button>
              {showReads && (
                <div className="mt-3 flex flex-col gap-2">
                  {readStatus.reads.map((r: any) => (
                    <div key={r.user?.id ?? r.user_id} className="flex items-center justify-between text-sm">
                      <span className="text-[#1E293B] font-medium">{r.user?.name}</span>
                      <span className="text-[#94A3B8] text-xs">{new Date(r.read_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
