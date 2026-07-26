'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Global navigation spinner. App Router has no router events, so we detect the
 * START of a navigation two ways — a click on an internal <a> (covers menu items
 * and links) and a patched history.pushState (covers programmatic router.push) —
 * and the END when the pathname/query actually changes.
 *
 * A short delay before showing means instant client transitions don't flicker;
 * the branded overlay only appears when there's a real wait (e.g. the next page
 * still compiling in dev, or data loading). A safety timeout guarantees it can
 * never get stuck if a navigation is cancelled.
 */
function RouteSpinnerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    if (safetyTimer.current) clearTimeout(safetyTimer.current)
    showTimer.current = null
    safetyTimer.current = null
  }

  // The route changed → navigation finished. Cancel any pending show and hide.
  useEffect(() => {
    clearTimers()
    setVisible(false)
  }, [pathname, searchParams])

  useEffect(() => {
    const begin = () => {
      clearTimers()
      showTimer.current = setTimeout(() => setVisible(true), 150)
      safetyTimer.current = setTimeout(() => setVisible(false), 15000)
    }

    // 1) Internal link clicks (sidebar menu, breadcrumbs, cards, …).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const target = anchor.getAttribute('target')
      if (target && target !== '_self') return
      if (anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      // Same page (or just a hash jump) → no navigation to wait on.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      begin()
    }
    document.addEventListener('click', onClick, true)

    // 2) Programmatic navigations (router.push) route through history.pushState.
    const origPush = window.history.pushState
    window.history.pushState = function (
      this: History,
      ...args: Parameters<typeof window.history.pushState>
    ) {
      const next = args[2]
      if (next != null) {
        try {
          const u = new URL(String(next), window.location.href)
          if (u.pathname !== window.location.pathname || u.search !== window.location.search) begin()
        } catch {
          /* ignore malformed URLs */
        }
      }
      return origPush.apply(this, args)
    }

    return () => {
      document.removeEventListener('click', onClick, true)
      window.history.pushState = origPush
      clearTimers()
    }
  }, [])

  if (!visible) return null

  return (
    <div className="route-spinner-overlay" role="status" aria-live="polite" aria-label="Loading">
      <div className="route-spinner-card">
        <div className="v2e-spinner" aria-hidden>
          <div className="blob top" />
          <div className="blob bottom" />
          <div className="blob left" />
          <div className="blob move-blob" />
        </div>
        <div className="route-spinner-brand">V2E</div>
      </div>
    </div>
  )
}

export default function RouteSpinner() {
  // useSearchParams requires a Suspense boundary during static rendering.
  return (
    <Suspense fallback={null}>
      <RouteSpinnerInner />
    </Suspense>
  )
}
