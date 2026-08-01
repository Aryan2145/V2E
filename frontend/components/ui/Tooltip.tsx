'use client'

import React, { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  /** Tooltip content. When empty/false, the child renders with no tooltip behaviour. */
  label: React.ReactNode
  /** A single element to attach the tooltip to (must accept a ref + DOM event handlers). */
  children: React.ReactElement
  /** Preferred side; flips automatically when there isn't room. */
  placement?: 'top' | 'bottom'
}

/**
 * Styled hover/focus tooltip that REPLACES the native `title=""` OS bubble (banned by
 * DESIGN_RULES). The bubble is rendered through a portal to <body> with `position: fixed`
 * and a high z-index, so it is never clipped by an `overflow-auto` ancestor and never
 * painted behind the sidebar/top-nav (both of which sit in lower stacking contexts).
 *
 * It attaches to its child via cloneElement — no extra wrapper DOM node — so it can wrap
 * an existing element without changing layout. Keep `aria-label` on the child for screen
 * readers; this only adds the visual bubble.
 */
export default function Tooltip({ label, children, placement = 'top' }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number; place: 'top' | 'bottom' } | null>(null)
  const elRef = useRef<HTMLElement | null>(null)

  const show = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Flip below when too close to the top of the viewport to draw above.
    const place: 'top' | 'bottom' = placement === 'top' && r.top < 48 ? 'bottom' : placement
    setPos({
      x: Math.min(Math.max(r.left + r.width / 2, 10), window.innerWidth - 10),
      y: place === 'top' ? r.top - 8 : r.bottom + 8,
      place,
    })
  }, [placement])

  const hide = useCallback(() => setPos(null), [])

  // Merge our ref with any ref the child already carries.
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      elRef.current = node
      const { ref } = children as unknown as { ref?: React.Ref<HTMLElement> }
      if (typeof ref === 'function') ref(node)
      else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<HTMLElement | null>).current = node
    },
    [children],
  )

  if (label === null || label === undefined || label === false || label === '') return children

  const childProps = children.props as Record<string, ((e: unknown) => void) | undefined>
  const trigger = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    ref: setRef,
    onMouseEnter: (e: unknown) => { show(); childProps.onMouseEnter?.(e) },
    onMouseLeave: (e: unknown) => { hide(); childProps.onMouseLeave?.(e) },
    onFocus: (e: unknown) => { show(); childProps.onFocus?.(e) },
    onBlur: (e: unknown) => { hide(); childProps.onBlur?.(e) },
  } as Record<string, unknown>)

  return (
    <>
      {trigger}
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              transform: `translate(-50%, ${pos.place === 'top' ? '-100%' : '0'})`,
            }}
            className="pointer-events-none z-[80] max-w-[260px] rounded-[6px] bg-[#0F172A] px-2 py-1 text-[11px] font-medium leading-snug text-white shadow-[0_4px_16px_rgba(0,0,0,0.28)]"
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  )
}
