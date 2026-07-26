'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './context'
import { getMyEntitlements, type EntitlementState } from '@/lib/api/organizations'

// Per-org cache so the layout + nav don't each refetch.
const cache = new Map<string, Record<string, EntitlementState>>()
const inflight = new Map<string, Promise<Record<string, EntitlementState>>>()

export function useEntitlements() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [map, setMap] = useState<Record<string, EntitlementState> | null>(
    orgId ? cache.get(orgId) ?? null : null,
  )
  const [loading, setLoading] = useState(!map)

  useEffect(() => {
    if (!orgId || user?.isSuperAdmin) {
      setLoading(false)
      return
    }
    if (cache.has(orgId)) {
      setMap(cache.get(orgId)!)
      setLoading(false)
      return
    }
    // Switching to an org we haven't loaded yet — drop any previous org's map so
    // the nav fails CLOSED (renders nothing gated) until this org's ceiling
    // arrives, instead of briefly showing the prior org's modules.
    let cancelled = false
    setMap(null)
    setLoading(true)
    const req =
      inflight.get(orgId) ??
      getMyEntitlements(orgId).then((m) => {
        cache.set(orgId, m)
        inflight.delete(orgId)
        return m
      })
    inflight.set(orgId, req)
    req
      .then((m) => { if (!cancelled) setMap(m) })
      .catch(() => { if (!cancelled) setMap({}) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, user?.isSuperAdmin])

  return {
    loading,
    entitlements: map,
    /** State for a module key, or undefined while loading / for super admins. */
    state: (moduleKey: string): EntitlementState | undefined => map?.[moduleKey],
  }
}

export function clearEntitlementsCache(orgId?: string) {
  if (orgId) cache.delete(orgId)
  else cache.clear()
}
