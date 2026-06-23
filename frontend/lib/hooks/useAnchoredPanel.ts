'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface AnchoredPos {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

/**
 * Positions a popover panel as a fixed overlay anchored to a trigger button —
 * so it renders OVER page/modal content instead of pushing it down. The panel
 * should be portaled to <body> and given `style` from `pos` + a high z-index.
 *
 * - Flips above the trigger when there isn't room below.
 * - Clamps within the nearest scrollable ancestor (e.g. a modal body), so it
 *   never crosses the top/bottom of the containing form.
 * - Repositions on outer scroll/resize (ignores scrolls inside the panel),
 *   and closes on Escape / outside-click.
 */
export interface AnchoredOpts {
  /** Fixed height of one list row, in px. When set, the panel height snaps to a
   *  whole number of rows so no item is half-cut at rest. Only use when rows are
   *  uniform height. */
  rowHeight?: number
  /** Non-list chrome height (search header etc.) excluded from row snapping. */
  headerHeight?: number
  /** Hard cap on panel height. */
  maxHeight?: number
  /** Margin kept from the container edges. */
  pad?: number
  /** Gap between the trigger and the panel. */
  gap?: number
}

export function useAnchoredPanel(
  open: boolean,
  close: () => void,
  opts: AnchoredOpts = {},
) {
  const { rowHeight, headerHeight = 46, maxHeight: maxCap = 300, pad: PAD = 20, gap: GAP = 6 } = opts
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<AnchoredPos | null>(null)

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()

    // Clamp within the nearest scrollable ancestor, not the whole viewport.
    let boundTop = PAD
    let boundBottom = window.innerHeight - PAD
    let node: HTMLElement | null = t.parentElement
    while (node) {
      const oy = getComputedStyle(node).overflowY
      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
        const br = node.getBoundingClientRect()
        boundTop = br.top + PAD
        boundBottom = br.bottom - PAD
        break
      }
      node = node.parentElement
    }

    const spaceBelow = boundBottom - r.bottom - GAP
    const spaceAbove = r.top - boundTop - GAP
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow
    let maxHeight = Math.min(maxCap, openUp ? spaceAbove : spaceBelow)
    // Snap to a whole number of rows so the last visible item isn't half-cut.
    if (rowHeight && maxHeight > headerHeight + rowHeight) {
      const rows = Math.max(1, Math.floor((maxHeight - headerHeight) / rowHeight))
      maxHeight = rows * rowHeight + headerHeight
    }
    const left = Math.min(Math.max(8, r.left), window.innerWidth - r.width - 8)
    setPos(
      openUp
        ? { left, width: r.width, maxHeight, bottom: window.innerHeight - r.top + GAP }
        : { left, width: r.width, maxHeight, top: r.bottom + GAP },
    )
  }, [rowHeight, headerHeight, maxCap, PAD, GAP])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const reposition = (e?: Event) => {
      // Ignore scrolls originating inside the panel — only follow outer scroll.
      if (e && panelRef.current?.contains(e.target as Node)) return
      place()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, place, close])

  const style: React.CSSProperties | undefined = pos
    ? {
        position: 'fixed',
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        top: pos.top,
        bottom: pos.bottom,
      }
    : undefined

  return { triggerRef, panelRef, pos, style }
}
