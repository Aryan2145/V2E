'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, BellRing, CheckCheck, Monitor, CheckCircle2,
  MessageSquare, ArrowRightLeft, Paperclip, UserPlus, UserMinus, RotateCcw, AlertTriangle, RefreshCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useNotifications } from '@/lib/notifications/NotificationsProvider'
import { useToast } from '@/components/ui/Toast'
import { enablePush, disablePush, getPushStatus, PUSH_ERROR_MESSAGES, type PushStatus } from '@/lib/push'
import type { AppNotification } from '@/lib/api/notifications'

const MODULE_COLORS: Record<string, string> = {
  tasks: 'bg-[#EFF6FF] text-[#2563EB]',
  projects: 'bg-[#F5F3FF] text-[#7C3AED]',
  workflows: 'bg-[#ECFDF5] text-[#059669]',
  tickets: 'bg-[#FFF7ED] text-[#D97706]',
  meetings: 'bg-[#F0FDF4] text-[#16A34A]',
  communication: 'bg-[#FDF2F8] text-[#BE185D]',
  system: 'bg-[#F1F5F9] text-[#475569]',
}

// A glanceable icon + tint per notification type, keyed loosely on the event so you
// can scan the list by shape (comment vs status vs file …) instead of reading each one.
function eventVisual(eventType: string, moduleKey: string): { Icon: LucideIcon; className: string } {
  const e = eventType || ''
  if (e.includes('comment')) return { Icon: MessageSquare, className: 'bg-[#EFF6FF] text-[#2563EB]' }
  if (e.includes('status')) return { Icon: ArrowRightLeft, className: 'bg-[#EEF2FF] text-[#4F46E5]' }
  if (e.includes('attachment')) return { Icon: Paperclip, className: 'bg-[#F0F9FF] text-[#0EA5E9]' }
  if (e.includes('completed')) return { Icon: CheckCircle2, className: 'bg-[#F0FDF4] text-[#16A34A]' }
  if (e.includes('reopen')) return { Icon: RotateCcw, className: 'bg-[#FFFBEB] text-[#D97706]' }
  if (e.includes('unassigned')) return { Icon: UserMinus, className: 'bg-[#FEF2F2] text-[#DC2626]' }
  if (e.includes('assigned')) return { Icon: UserPlus, className: 'bg-[#EFF6FF] text-[#2563EB]' }
  if (e.includes('overdue') || e.includes('escalat') || e.includes('breach')) return { Icon: AlertTriangle, className: 'bg-[#FEF2F2] text-[#DC2626]' }
  if (e.includes('recurring') || e.includes('reminder')) return { Icon: RefreshCw, className: 'bg-[#F1F5F9] text-[#475569]' }
  return { Icon: Bell, className: MODULE_COLORS[moduleKey] ?? MODULE_COLORS.system }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationBell() {
  const router = useRouter()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { unreadCount, latest, refresh, markRead, markAllRead } = useNotifications()
  const { addToast } = useToast()

  const [open, setOpen] = useState(false)
  const [pushStatus, setPushStatus] = useState<PushStatus>('unsupported')
  const [pushBusy, setPushBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getPushStatus().then(setPushStatus)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!user || !orgId) return null

  function openPanel() {
    setOpen((v) => {
      if (!v) refresh()
      return !v
    })
  }

  async function handleItemClick(n: AppNotification) {
    if (!n.is_read) await markRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  async function togglePush() {
    setPushBusy(true)
    try {
      if (pushStatus === 'enabled') {
        await disablePush(orgId)
        setPushStatus(await getPushStatus())
        addToast('Device notifications turned off for this device', 'info')
      } else {
        const result = await enablePush(orgId)
        setPushStatus(await getPushStatus())
        if (result.ok) {
          addToast("Device notifications are on — you'll get alerts on this device", 'success')
        } else {
          addToast(PUSH_ERROR_MESSAGES[result.reason], 'error')
          if (result.detail) console.warn('[push] enable failed:', result.reason, result.detail)
        }
      }
    } catch {
      addToast('Something went wrong updating device notifications.', 'error')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={openPanel}
        title="Notifications"
        className="relative w-10 h-10 rounded-[8px] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#DC2626] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[calc(100vw-1.5rem)] max-w-[380px] bg-white rounded-[10px] border border-[#E2E8F0] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <p className="text-sm font-semibold text-[#0F172A]">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[min(380px,70vh)] overflow-y-auto">
            {latest.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={22} className="mx-auto text-[#CBD5E1] mb-2" />
                <p className="text-sm text-[#64748B]">No notifications yet</p>
              </div>
            ) : (
              latest.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={[
                    'w-full text-left px-4 py-3 border-b border-[#F8FAFC] transition-colors hover:bg-[#F8FAFC]',
                    n.is_read ? '' : 'bg-[#EFF6FF]/40',
                  ].join(' ')}
                >
                  {(() => {
                    const { Icon, className } = eventVisual(n.event_type, n.module)
                    return (
                      <div className="flex items-start gap-2.5">
                        {/* Type icon badge */}
                        <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${className}`}>
                          <Icon size={15} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-[#0F172A] truncate">{n.title}</p>
                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />}
                            <span
                              className={`ml-auto shrink-0 inline-flex rounded-[999px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${MODULE_COLORS[n.module] ?? MODULE_COLORS.system}`}
                            >
                              {n.module}
                            </span>
                          </div>
                          {/* Body may carry a second "on <task>" line — keep the break. */}
                          <p className="text-xs text-[#475569] mt-0.5 line-clamp-3 whitespace-pre-line">{n.body}</p>
                          <p className="text-[11px] text-[#94A3B8] mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    )
                  })()}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#F1F5F9]">
            {pushStatus === 'enabled' ? (
              // Connected: confirm the state clearly, with Disable as a distinct action.
              <div className="flex items-center gap-2 px-4 py-2.5 text-xs">
                <CheckCircle2 size={14} className="shrink-0 text-[#16A34A]" />
                <span className="flex-1 font-medium text-[#15803D]">Device notifications on</span>
                <button
                  onClick={togglePush}
                  disabled={pushBusy}
                  className="shrink-0 font-medium text-[#64748B] hover:text-[#DC2626] disabled:opacity-60 transition-colors"
                >
                  {pushBusy ? 'Disabling…' : 'Disable'}
                </button>
              </div>
            ) : pushStatus !== 'unsupported' ? (
              <button
                onClick={togglePush}
                disabled={pushBusy || pushStatus === 'denied'}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
              >
                <Monitor size={13} />
                {pushStatus === 'denied'
                  ? 'Notifications blocked in browser settings'
                  : pushBusy
                    ? 'Enabling…'
                    : 'Enable device notifications (desktop & mobile)'}
              </button>
            ) : null}
            <button
              onClick={() => {
                setOpen(false)
                router.push('/dashboard/notifications')
              }}
              className="w-full px-4 py-2.5 text-center text-sm font-medium text-[#2563EB] hover:bg-[#EFF6FF] border-t border-[#F1F5F9] transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
