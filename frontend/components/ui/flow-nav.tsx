'use client'

// Shared canvas navigation for every ReactFlow surface in the app (process map, department
// tree, employee tree). This is the single source of the Figma-style feel so all three canvases
// behave IDENTICALLY:
//   • wheel / two-finger scroll = pan   • ⌘/Ctrl+scroll or trackpad-pinch = zoom
//   • drag empty space = pan (or marquee-select when `marquee` is on)   • hold Space to pan
//   • bounded panning (content + margin, never infinite empty space)
//   • faint edge scrollbars (the visible pan affordance for a mouse user)
//   • smooth ease on pan, instant/1:1 on zoom + scrollbar-drag
//   • auto-hide minimap (only when the content is bigger than the pane)
//   • touch devices always one-finger pan + pinch zoom (no marquee, no scrollbars)
//
// Usage (inside a <ReactFlowProvider>):
//   const nav = useFlowNav(nodes, { marquee: canEdit })
//   <FlowNavStyles />
//   <ReactFlow {...nav.flowProps} minZoom={0.2} maxZoom={2} /* + your own handlers */>
//     {!nav.isTouch && <CanvasScrollbars nodes={nodes} setInstant={nav.setInstant} />}
//     {nav.needsMinimap && <MiniMap ... />}
//   </ReactFlow>

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SelectionMode, useReactFlow, useStore, type Node } from 'reactflow'

// Panning is bounded to the content plus this margin (breathing room, not infinite space). The
// scrollbars use the SAME margin, so a bar shows exactly when that axis can scroll and the thumb
// maps 1:1 to the real range.
export const PAN_PAD = 300

// A short ease on the viewport transform turns discrete wheel-scroll / zoom steps into smooth
// glides. `flow-nav-instant` (added on the root while zooming or dragging a scrollbar thumb)
// removes it so those stay 1:1 with the pointer. Node-dragging is unaffected (nodes live inside
// the viewport). Scoped to `.flow-nav`, so it only touches canvases that opt in.
export const FLOW_NAV_CSS = `
.flow-nav .react-flow__viewport { transition: transform 90ms ease-out; }
.flow-nav.flow-nav-instant .react-flow__viewport { transition: none; }
`

export function FlowNavStyles() {
  return <style>{FLOW_NAV_CSS}</style>
}

// Content bounds of the top-level (non-child) nodes — the basis for both the pan extent and the
// minimap "is it bigger than the pane?" test.
function useContentBounds(nodes: Node[]) {
  return useMemo(() => {
    const tops = nodes.filter((n) => !n.parentNode)
    if (!tops.length) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of tops) {
      const w = n.width ?? 200, h = n.height ?? 100
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h)
    }
    return { minX, minY, maxX, maxY, count: tops.length }
  }, [nodes])
}

// The main hook. Call INSIDE a <ReactFlowProvider>. Spread `flowProps` onto <ReactFlow>; the
// caller keeps ownership of its own handlers, node/edge types and zoom limits.
export function useFlowNav(nodes: Node[], opts?: { marquee?: boolean }) {
  // Touch devices always one-finger pan (no marquee, no scrollbars) and a tap drills into a node.
  // We detect touch by CAPABILITY, not the primary pointer: on an iPad the primary pointer reads
  // as "fine" when a trackpad/keyboard is attached (and iPadOS can identify as desktop), which
  // made single-tap-to-open fail. `(any-pointer: coarse)` and maxTouchPoints stay truthful there.
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(any-pointer: coarse)')
    const on = () => setIsTouch(mq.matches || (navigator.maxTouchPoints ?? 0) > 0)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  const marquee = !!opts?.marquee && !isTouch

  const bounds = useContentBounds(nodes)
  const paneW = useStore((s) => s.width)
  const paneH = useStore((s) => s.height)
  const zoom = useStore((s) => s.transform[2])

  // Bound panning to content + margin so you can't scroll off into infinite empty space.
  const translateExtent = useMemo<[[number, number], [number, number]]>(() => {
    if (!bounds) return [[-Infinity, -Infinity], [Infinity, Infinity]]
    return [[bounds.minX - PAN_PAD, bounds.minY - PAN_PAD], [bounds.maxX + PAN_PAD, bounds.maxY + PAN_PAD]]
  }, [bounds])

  // The minimap earns its place only when the content is bigger than the pane — otherwise it's
  // clutter with nothing to navigate. Depends on zoom / pane size, not on pan position.
  const needsMinimap = useMemo(() => {
    if (!bounds || bounds.count < 2 || !paneW || !paneH) return false
    return (bounds.maxX - bounds.minX) * zoom > paneW + 24 || (bounds.maxY - bounds.minY) * zoom > paneH + 24
  }, [bounds, paneW, paneH, zoom])

  // Kill the pan ease whenever the zoom level changes (wheel, pinch, buttons, fit) so zoom stays
  // instant and locked to the cursor, then restore it shortly after. Also exposed as `setInstant`
  // so a scrollbar-thumb drag can hold it off for the length of the drag.
  const [instant, setInstant] = useState(false)
  const prevZoom = useRef(zoom)
  useEffect(() => {
    if (prevZoom.current === zoom) return
    prevZoom.current = zoom
    setInstant(true)
    const t = setTimeout(() => setInstant(false), 120)
    return () => clearTimeout(t)
  }, [zoom])

  const flowProps = {
    className: `flow-nav${instant ? ' flow-nav-instant' : ''}`,
    selectionOnDrag: marquee,
    selectionMode: SelectionMode.Partial,
    panOnDrag: marquee ? [1, 2] : true,
    panOnScroll: !isTouch,
    zoomOnScroll: false,
    zoomActivationKeyCode: ['Meta', 'Control'],
    panActivationKeyCode: 'Space',
    deleteKeyCode: null,
    zoomOnPinch: true,
    translateExtent,
    proOptions: { hideAttribution: true },
  }

  return { flowProps, needsMinimap, isTouch, setInstant }
}

// Faint Figma-style scrollbars. In the Figma nav model a left-drag can make a selection box, so
// these are the one *visible* way for a mouse user to pan — especially horizontally, which matters
// because these canvases grow sideways. Dragging a thumb pans the viewport. They auto-hide when
// the whole canvas already fits, and inset to clear the zoom controls / minimap. Pass `setInstant`
// (from useFlowNav) so the thumb tracks the pointer 1:1 while dragging.
export function CanvasScrollbars({ nodes, setInstant }: { nodes: Node[]; setInstant?: (v: boolean) => void }) {
  const { setViewport } = useReactFlow()
  const tx = useStore((s) => s.transform[0])
  const ty = useStore((s) => s.transform[1])
  const zoom = useStore((s) => s.transform[2])
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  const drag = useRef<{ axis: 'h' | 'v'; startX: number; startY: number; tx: number; ty: number } | null>(null)

  // The bars are a thin strip at the extreme edge; the zoom controls and minimap sit ~15px inside,
  // so they never collide. Only a small corner gap (VB/HR) keeps the two bars from crossing.
  const HL = 8, HR = 16, VT = 8, VB = 16

  const geo = useMemo(() => {
    const tops = nodes.filter((n) => !n.parentNode)
    if (!tops.length || !width || !height) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of tops) {
      const w = n.width ?? 200, h = n.height ?? 100
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h)
    }
    const exL = minX - PAN_PAD, exT = minY - PAN_PAD
    const exW = (maxX - minX) + PAN_PAD * 2, exH = (maxY - minY) + PAN_PAD * 2
    if (exW <= 0 || exH <= 0) return null
    const visL = -tx / zoom, visT = -ty / zoom
    const visW = width / zoom, visH = height / zoom
    return {
      exW, exH,
      // Extent = content + the same margin panning is bounded to, so a bar shows exactly when that
      // axis can scroll, and the thumb maps 1:1 to the real range. Visibility depends only on zoom
      // (not pan position), so a bar never blinks out mid-scroll.
      showH: exW * zoom > width + 1,
      showV: exH * zoom > height + 1,
      hLeft: (visL - exL) / exW, hSize: visW / exW,
      vTop: (visT - exT) / exH, vSize: visH / exH,
    }
  }, [nodes, tx, ty, zoom, width, height])

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current, g = geo
    if (!d || !g) return
    if (d.axis === 'h') {
      const trackW = width - HL - HR
      const dxPx = e.clientX - d.startX
      setViewport({ x: d.tx - (dxPx / trackW) * g.exW * zoom, y: d.ty, zoom })
    } else {
      const trackH = height - VT - VB
      const dyPx = e.clientY - d.startY
      setViewport({ x: d.tx, y: d.ty - (dyPx / trackH) * g.exH * zoom, zoom })
    }
  }, [geo, width, height, zoom, setViewport, HL, HR, VT, VB])

  const onUp = useCallback(() => {
    drag.current = null
    setInstant?.(false) // re-enable the smooth ease once the thumb is released
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }, [onMove, setInstant])

  const onDown = useCallback((axis: 'h' | 'v', e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    drag.current = { axis, startX: e.clientX, startY: e.clientY, tx, ty }
    setInstant?.(true) // thumb-drag tracks the pointer 1:1 — hold the ease off for the drag
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [tx, ty, onMove, onUp, setInstant])

  if (!geo || (!geo.showH && !geo.showV)) return null
  const hLeft = Math.max(0, Math.min(geo.hLeft, 1 - geo.hSize))
  const vTop = Math.max(0, Math.min(geo.vTop, 1 - geo.vSize))
  return (
    <>
      {geo.showH && (
        <div className="absolute z-10 pointer-events-none" style={{ left: HL, right: HR, bottom: 3, height: 9 }}>
          <div onPointerDown={(e) => onDown('h', e)} role="scrollbar" aria-orientation="horizontal"
            className="absolute top-0 h-full rounded-full bg-[#94A3B8]/40 hover:bg-[#64748B]/70 pointer-events-auto cursor-grab active:cursor-grabbing transition-colors"
            style={{ left: `${hLeft * 100}%`, width: `${geo.hSize * 100}%`, minWidth: 28 }} />
        </div>
      )}
      {geo.showV && (
        <div className="absolute z-10 pointer-events-none" style={{ right: 3, top: VT, bottom: VB, width: 9 }}>
          <div onPointerDown={(e) => onDown('v', e)} role="scrollbar" aria-orientation="vertical"
            className="absolute left-0 w-full rounded-full bg-[#94A3B8]/40 hover:bg-[#64748B]/70 pointer-events-auto cursor-grab active:cursor-grabbing transition-colors"
            style={{ top: `${vTop * 100}%`, height: `${geo.vSize * 100}%`, minHeight: 28 }} />
        </div>
      )}
    </>
  )
}
