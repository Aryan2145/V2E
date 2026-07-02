'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { notificationsApi, type AppNotification } from '@/lib/api/notifications'
import { useNotifications } from '@/lib/notifications/NotificationsProvider'

const MODULE_COLORS: Record<string, string> = {
  tasks: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  projects: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]',
  workflows: 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]',
  tickets: 'bg-[#FFF7ED] text-[#D97706] border-[#FED7AA]',
  meetings: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
  communication: 'bg-[#FDF2F8] text-[#BE185D] border-[#FBCFE8]',
  system: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',
}

const MODULE_FILTERS = ['all', 'tasks', 'projects', 'workflows', 'tickets', 'meetings'] as const

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { markAllRead: markAllReadGlobal, refresh: refreshBell } = useNotifications()

  const [items, setItems] = useState<AppNotification[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moduleFilter, setModuleFilter] = useState<(typeof MODULE_FILTERS)[number]>('all')

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await notificationsApi.list(orgId, undefined, 30)
      setItems(res.items)
      setCursor(res.next_cursor)
      setUnread(res.unread_count)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await notificationsApi.list(orgId, cursor, 30)
      setItems((prev) => [...prev, ...res.items])
      setCursor(res.next_cursor)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)))
      setUnread((c) => Math.max(0, c - 1))
      notificationsApi.markRead(orgId, n.id).then(refreshBell).catch(() => null)
    }
    if (n.link) router.push(n.link)
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })))
    setUnread(0)
    await markAllReadGlobal()
  }

  const filtered = moduleFilter === 'all' ? items : items.filter((n) => n.module === moduleFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Notifications</h1>
          <p className="mt-1 text-[15px] text-[#475569]">
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? 's' : ''}` : 'You’re all caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-2 px-4 py-[9px] text-sm font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] hover:bg-[#DBEAFE] transition-colors shrink-0"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {/* Module filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {MODULE_FILTERS.map((m) => (
          <button
            key={m}
            onClick={() => setModuleFilter(m)}
            className={[
              'px-3 py-1.5 rounded-[999px] text-xs font-semibold capitalize transition-colors',
              moduleFilter === m
                ? 'bg-[#2563EB] text-white'
                : 'bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]',
            ].join(' ')}
          >
            {m === 'all' ? 'All' : m}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <Bell size={24} className="text-[#94A3B8]" />
          </div>
          <p className="font-semibold text-[#0F172A]">No notifications</p>
          <p className="text-sm text-[#475569] mt-1">Activity on your tasks and projects will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] divide-y divide-[#F1F5F9] overflow-hidden">
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={[
                'w-full text-left px-5 py-4 transition-colors hover:bg-[#F8FAFC]',
                n.is_read ? '' : 'bg-[#EFF6FF]/40',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                {!n.is_read && <span className="mt-2 w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />}
                <div className={`flex-1 min-w-0 ${n.is_read ? 'pl-5' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[#0F172A]">{n.title}</p>
                    <span
                      className={`inline-flex rounded-[999px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${MODULE_COLORS[n.module] ?? MODULE_COLORS.system}`}
                    >
                      {n.module}
                    </span>
                  </div>
                  <p className="text-sm text-[#475569] mt-0.5 whitespace-pre-line">{n.body}</p>
                  <p className="text-xs text-[#94A3B8] mt-1.5">{formatWhen(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2.5 text-sm font-medium text-[#2563EB] bg-white border border-[#E2E8F0] rounded-[10px] hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
        >
          {loadingMore ? 'Loading…' : 'Load older notifications'}
        </button>
      )}
    </div>
  )
}
