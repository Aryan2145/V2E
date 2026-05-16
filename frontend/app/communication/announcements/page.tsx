'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { getAnnouncements, markAnnouncementRead, togglePinAnnouncement, deleteAnnouncement } from '@/lib/api/announcements'
import type { Announcement } from '@/lib/types/communication'
import Link from 'next/link'
import { Bell, Pin, Plus, Trash2, Eye } from 'lucide-react'

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-[#FEE2E2] text-[#DC2626]',
  high: 'bg-[#FEF3C7] text-[#D97706]',
  normal: 'bg-[#F1F5F9] text-[#475569]',
}

const TYPE_LABEL: Record<string, string> = {
  general: 'General',
  policy: 'Policy',
  event: 'Event',
  emergency: 'Emergency',
}

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const orgId = user?.organization_id ?? ''
  const isHR = user?.role === 'org_admin' || user?.role === 'hr_manager'
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{ type?: string; priority?: string }>({})

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    getAnnouncements(orgId, filter)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [orgId, filter])

  async function handleRead(id: string) {
    if (!orgId) return
    await markAnnouncementRead(orgId, id)
    setItems(prev => prev.map(a => a.id === id ? { ...a, reads: [{ read_at: new Date().toISOString() }] } : a))
  }

  async function handlePin(id: string) {
    if (!orgId) return
    const updated = await togglePinAnnouncement(orgId, id)
    setItems(prev => prev.map(a => a.id === id ? { ...a, is_pinned: updated.is_pinned } : a))
  }

  async function handleDelete(id: string) {
    if (!orgId) return
    await deleteAnnouncement(orgId, id)
    setItems(prev => prev.filter(a => a.id !== id))
  }

  const pinned = items.filter(a => a.is_pinned)
  const rest = items.filter(a => !a.is_pinned)

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Announcements</h1>
            <p className="text-sm text-[#475569] mt-0.5">Official communications from leadership</p>
          </div>
          {isHR && (
            <Link
              href="/communication/announcements/new"
              className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
            >
              <Plus size={16} />
              New Announcement
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['general', 'policy', 'event', 'emergency'].map(t => (
            <button
              key={t}
              onClick={() => setFilter(f => ({ ...f, type: f.type === t ? undefined : t }))}
              className={[
                'px-3 py-1.5 rounded-[6px] text-xs font-semibold capitalize transition-colors',
                filter.type === t
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
          {['urgent', 'high'].map(p => (
            <button
              key={p}
              onClick={() => setFilter(f => ({ ...f, priority: f.priority === p ? undefined : p }))}
              className={[
                'px-3 py-1.5 rounded-[6px] text-xs font-semibold capitalize transition-colors',
                filter.priority === p
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell size={40} className="text-[#CBD5E1] mb-3" />
            <p className="text-[#475569] font-medium">No announcements</p>
            <p className="text-sm text-[#94A3B8]">Check back later for updates</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {pinned.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Pinned</p>
                {pinned.map(a => <AnnouncementCard key={a.id} ann={a} isHR={isHR} onRead={handleRead} onPin={handlePin} onDelete={handleDelete} />)}
                {rest.length > 0 && <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mt-2">Recent</p>}
              </>
            )}
            {rest.map(a => <AnnouncementCard key={a.id} ann={a} isHR={isHR} onRead={handleRead} onPin={handlePin} onDelete={handleDelete} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function AnnouncementCard({
  ann, isHR, onRead, onPin, onDelete,
}: {
  ann: Announcement
  isHR: boolean
  onRead: (id: string) => void
  onPin: (id: string) => void
  onDelete: (id: string) => void
}) {
  const hasRead = ann.reads && ann.reads.length > 0

  return (
    <div className={[
      'bg-white border rounded-[12px] p-5 flex flex-col gap-3',
      ann.is_pinned ? 'border-[#2563EB]' : 'border-[#E2E8F0]',
      !hasRead ? 'border-l-4 border-l-[#2563EB]' : '',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_BADGE[ann.priority] ?? PRIORITY_BADGE.normal}`}>
              {ann.priority.toUpperCase()}
            </span>
            <span className="text-xs text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
              {TYPE_LABEL[ann.type] ?? ann.type}
            </span>
            {ann.is_pinned && <Pin size={12} className="text-[#2563EB]" />}
          </div>
          <Link href={`/communication/announcements/${ann.id}`}>
            <h3 className="text-base font-semibold text-[#0F172A] hover:text-[#2563EB] transition-colors line-clamp-1">
              {ann.title}
            </h3>
          </Link>
          <p className="text-sm text-[#475569] mt-1 line-clamp-2 whitespace-pre-wrap">{ann.body}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!hasRead && (
            <button
              onClick={() => onRead(ann.id)}
              className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
              title="Mark as read"
            >
              <Eye size={15} />
            </button>
          )}
          {isHR && (
            <>
              <button
                onClick={() => onPin(ann.id)}
                className={`p-1.5 rounded-[6px] transition-colors ${ann.is_pinned ? 'text-[#2563EB] hover:bg-[#EFF6FF]' : 'text-[#475569] hover:bg-[#F1F5F9]'}`}
                title={ann.is_pinned ? 'Unpin' : 'Pin'}
              >
                <Pin size={15} />
              </button>
              <button
                onClick={() => onDelete(ann.id)}
                className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
        <span>By {ann.created_by?.name}</span>
        <span>·</span>
        <span>{new Date(ann.published_at ?? ann.created_at).toLocaleDateString()}</span>
        <span>·</span>
        <span>{ann._count?.reads ?? 0} read</span>
      </div>
    </div>
  )
}
