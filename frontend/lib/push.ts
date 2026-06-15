import { notificationsApi } from '@/lib/api/notifications'

// Web Push subscription helpers. The service worker (public/sw.js) only handles
// push + notification clicks — it does no asset caching, so it's dev-safe.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export type PushStatus = 'unsupported' | 'denied' | 'enabled' | 'disabled'

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    return sub ? 'enabled' : 'disabled'
  } catch {
    return 'disabled'
  }
}

/** Ask permission, subscribe to push, and register with the backend. */
export async function enablePush(orgId: string): Promise<boolean> {
  if (!pushSupported()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const { key } = await notificationsApi.getVapidKey(orgId)
  if (!key) return false // backend has no VAPID keys configured

  const reg = await getRegistration()
  if (!reg) return false
  await navigator.serviceWorker.ready

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  })

  const json = sub.toJSON()
  await notificationsApi.subscribePush(orgId, {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    userAgent: navigator.userAgent,
  })
  return true
}

export async function disablePush(orgId: string): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await notificationsApi.unsubscribePush(orgId, sub.endpoint).catch(() => null)
    await sub.unsubscribe().catch(() => null)
  }
}
