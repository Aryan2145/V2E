'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import { notificationsApi, type AppNotification } from '@/lib/api/notifications'

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'

interface NotificationsContextValue {
  unreadCount: number
  latest: AppNotification[]
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  latest: [],
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
})

export function useNotifications() {
  return useContext(NotificationsContext)
}

/**
 * Global notification plumbing: real-time socket channel, unread badge state,
 * toast + OS banner on incoming notifications. Mounted once in the root layout.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const orgId = user?.organizationId ?? ''
  const userId = user?.id ?? ''

  const [unreadCount, setUnreadCount] = useState(0)
  const [latest, setLatest] = useState<AppNotification[]>([])
  const socketRef = useRef<Socket | null>(null)

  const refresh = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await notificationsApi.list(orgId, undefined, 10)
      setLatest(res.items)
      setUnreadCount(res.unread_count)
    } catch {
      /* not logged in yet / endpoint unavailable — bell just stays empty */
    }
  }, [orgId])

  const markRead = useCallback(
    async (id: string) => {
      if (!orgId) return
      setLatest((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      try {
        await notificationsApi.markRead(orgId, id)
      } catch {
        /* refresh will reconcile */
      }
    },
    [orgId],
  )

  const markAllRead = useCallback(async () => {
    if (!orgId) return
    setLatest((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    try {
      await notificationsApi.markAllRead(orgId)
    } catch {
      /* refresh will reconcile */
    }
  }, [orgId])

  // Initial load + periodic safety re-sync
  useEffect(() => {
    if (!orgId) return
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [orgId, refresh])

  // Real-time socket
  useEffect(() => {
    if (!userId) return
    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { userId },
      // Prefer websocket, but fall back to long-polling so a transient WS
      // failure (e.g. backend restarting in dev) degrades gracefully instead
      // of failing the connection outright.
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('notification', (n: AppNotification) => {
      setLatest((prev) => [n, ...prev].slice(0, 10))
      setUnreadCount((c) => c + 1)

      // In-app toast
      addToast(n.title, 'info')

      // OS banner when the tab isn't in focus (Windows/Mac system notification)
      try {
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          (document.hidden || !document.hasFocus())
        ) {
          const osNotif = new Notification(n.title, {
            body: n.body,
            tag: n.id,
            icon: '/icons/icon-192.png',
          })
          osNotif.onclick = () => {
            window.focus()
            if (n.link) router.push(n.link)
            osNotif.close()
          }
        }
      } catch {
        /* Notification API unavailable — ignore */
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <NotificationsContext.Provider value={{ unreadCount, latest, refresh, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}
