'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import { enablePush, getPushStatus } from '@/lib/push'

// One-time nudge to enable browser/device push, so users discover they can be
// notified even when V2E is closed. The enable/disable control also lives
// permanently in the notification bell — this is purely for discoverability.
// Shown at most once per user until they act on it or dismiss it.

const dismissKey = (userId: string) => `v2e_push_prompt_dismissed:${userId}`

export default function NotificationsOptInPrompt() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const orgId = user?.organizationId ?? ''
  const userId = user?.id ?? ''

  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!userId || !orgId) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem(dismissKey(userId))) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    // Only nudge when push is genuinely available and not already on/denied.
    getPushStatus().then((status) => {
      if (cancelled) return
      if (status === 'disabled') {
        // Small delay so it doesn't slam in during the initial page paint.
        timer = setTimeout(() => !cancelled && setShow(true), 2_500)
      }
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [userId, orgId])

  function dismiss() {
    if (userId) localStorage.setItem(dismissKey(userId), '1')
    setShow(false)
  }

  async function turnOn() {
    setBusy(true)
    try {
      const ok = await enablePush(orgId)
      if (ok) {
        addToast("Notifications are on — you'll get alerts even when V2E is closed", 'success')
      } else {
        addToast(
          typeof Notification !== 'undefined' && Notification.permission === 'denied'
            ? 'Notifications are blocked in your browser settings. Allow them to continue.'
            : 'Could not enable notifications. You can try again from the bell menu.',
          'error',
        )
      }
    } catch {
      addToast('Something went wrong enabling notifications.', 'error')
    } finally {
      setBusy(false)
      dismiss()
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] sm:w-[360px]">
      <div className="relative rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 text-[#94A3B8] transition-colors hover:text-[#475569]"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
            <Bell size={18} />
          </span>
          <div className="min-w-0 pr-4">
            <p className="text-[15px] font-semibold text-[#0F172A]">Turn on notifications</p>
            <p className="mt-0.5 text-[13px] leading-snug text-[#475569]">
              Get alerts for tasks, tickets and mentions on this device — even when V2E isn&apos;t open.
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-end gap-2">
          <button
            onClick={dismiss}
            disabled={busy}
            className="rounded-[8px] px-3 py-2 text-[13px] font-medium text-[#475569] transition-colors hover:bg-[#F1F5F9] disabled:opacity-60"
          >
            Not now
          </button>
          <button
            onClick={turnOn}
            disabled={busy}
            className="rounded-[8px] bg-[#2563EB] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
          >
            {busy ? 'Enabling…' : 'Turn on'}
          </button>
        </div>
      </div>
    </div>
  )
}
