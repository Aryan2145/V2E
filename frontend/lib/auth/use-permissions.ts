'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './context'
import { getMyPermissions, type MyPermissions, type PermAction, type DataScope } from '@/lib/api/permissions'

// Simple per-org cache so many components don't each refetch. Cleared on org switch
// by keying on organizationId.
const cache = new Map<string, MyPermissions>()
const inflight = new Map<string, Promise<MyPermissions>>()

export interface UsePermissions {
  loading: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  /** Fine-grained gate: does the current user effectively hold this leaf + action? */
  can: (featureKey: string, action: PermAction) => boolean
  /** Row-level data scope for a scopable content leaf + action (null if not granted). */
  scopeFor: (featureKey: string, action: PermAction) => DataScope | null
}

export function usePermissions(): UsePermissions {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [perms, setPerms] = useState<MyPermissions | null>(orgId ? cache.get(orgId) ?? null : null)
  const [loading, setLoading] = useState(!perms)

  useEffect(() => {
    if (!orgId || user?.isSuperAdmin) {
      setLoading(false)
      return
    }
    if (cache.has(orgId)) {
      setPerms(cache.get(orgId)!)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const req =
      inflight.get(orgId) ??
      getMyPermissions(orgId).then((p) => {
        cache.set(orgId, p)
        inflight.delete(orgId)
        return p
      })
    inflight.set(orgId, req)
    req
      .then((p) => { if (!cancelled) setPerms(p) })
      .catch(() => { if (!cancelled) setPerms({ leaves: {}, is_admin: false, is_super_admin: false }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orgId, user?.isSuperAdmin])

  const isSuperAdmin = !!user?.isSuperAdmin
  const isAdmin = isSuperAdmin || !!perms?.is_admin

  const can = (featureKey: string, action: PermAction): boolean => {
    if (isSuperAdmin) return true
    const leaf = perms?.leaves?.[featureKey]
    return !!leaf?.[action]
  }

  const scopeFor = (featureKey: string, action: PermAction): DataScope | null =>
    perms?.scopes?.[featureKey]?.[action] ?? null

  return { loading, isAdmin, isSuperAdmin, can, scopeFor }
}

/** Invalidate the cached permissions (e.g. after an admin edits them). */
export function clearPermissionsCache(orgId?: string) {
  if (orgId) cache.delete(orgId)
  else cache.clear()
}
