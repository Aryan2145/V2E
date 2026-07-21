'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// A lightweight styled hover tooltip to replace the browser's raw `title=` box.
// Portals to <body> (so the calendar's scroll/overflow never clips it) and tracks
// the cursor. Use once per component: spread the handlers onto each hoverable
// item and render {portal} anywhere in the tree.
//
//   const tip = useHoverTip()
//   <button {...tip.bind(<b>My meeting</b>)}>…</button>
//   {tip.portal}
export function useHoverTip() {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null)

  const bind = useCallback(
    (content: ReactNode) => ({
      onMouseEnter: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, content }),
      onMouseMove: (e: React.MouseEvent) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : { x: e.clientX, y: e.clientY, content })),
      onMouseLeave: () => setTip(null),
    }),
    [],
  )

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const portal =
    tip && typeof document !== 'undefined'
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              left: Math.min(tip.x + 14, vw - 272),
              top: Math.min(tip.y + 18, vh - 60),
              zIndex: 9999,
              pointerEvents: 'none',
            }}
            className="max-w-[260px] rounded-[8px] bg-[#0F172A] text-white text-xs leading-snug px-2.5 py-1.5 shadow-lg ring-1 ring-black/20"
          >
            {tip.content}
          </div>,
          document.body,
        )
      : null

  return { bind, portal }
}
