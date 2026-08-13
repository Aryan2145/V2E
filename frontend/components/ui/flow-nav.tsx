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
import { SelectionMode, useReactFlow, useStore, useStoreApi, type Node } from 'reactflow'

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
.flow-nav.flow-nav-zooming .react-flow__viewport { transition: none; }
/* Force a BLACK "+" over the connection dots — the OS crosshair theme can render white/faint. */
.flow-nav .react-flow__handle {
  cursor: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='18'%20height='18'%3E%3Cpath%20d='M9%201V17M1%209H17'%20stroke='%23000'%20stroke-width='1.75'/%3E%3C/svg%3E") 9 9, crosshair;
}
/* Bigger, easier grab target for the connection dots: an invisible hit area expanded mostly
   OUTWARD from the node edge (only a hair inward) so it's easy to start a line without stealing
   clicks meant for the node body. The dot itself stays small. */
.flow-nav .react-flow__handle::before { content: ''; position: absolute; }
.flow-nav .react-flow__handle-right::before  { top: -14px; bottom: -14px; left: -5px; right: -22px; }
.flow-nav .react-flow__handle-left::before   { top: -14px; bottom: -14px; right: -5px; left: -22px; }
.flow-nav .react-flow__handle-top::before    { left: -14px; right: -14px; bottom: -5px; top: -22px; }
.flow-nav .react-flow__handle-bottom::before { left: -14px; right: -14px; top: -5px; bottom: -22px; }
/* The OS cursor theme can be white/light → invisible on the white node body. Force a visible dark
   arrow (black fill, white outline, so it shows on any background) over nodes — including drillable
   nodes whose Tailwind cursor-pointer would otherwise use the same invisible OS cursor. */
.flow-nav .react-flow__node,
.flow-nav .react-flow__node .cursor-pointer {
  cursor: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='20'%20height='24'%3E%3Cpath%20d='M2%202L2%2018L6.5%2014L9.2%2020L11.6%2019L9%2013L14%2013Z'%20fill='%23000'%20stroke='%23fff'%20stroke-width='1.3'%20stroke-linejoin='round'/%3E%3C/svg%3E") 2 2, auto;
}
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

// Auto-scroll while box-selecting — the behaviour every design tool / spreadsheet has: drag a
// selection rectangle to the edge of the viewport and the canvas pans in that direction (faster the
// harder you push), so you can rubber-band over content that's off-screen. As it pans we re-emit a
// pointer move at the held cursor so ReactFlow keeps growing the selection into the revealed area.
// Only active while `enabled` (i.e. marquee mode) and a left-drag started on the empty canvas.
function useMarqueeAutoPan(nodes: Node[], enabled: boolean) {
  const { setViewport } = useReactFlow()
  const store = useStoreApi()
  const domNode = useStore((s) => s.domNode)
  const bounds = useContentBounds(nodes)
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds

  useEffect(() => {
    if (!enabled || !domNode) return
    const EDGE = 60 // px band along each side where auto-pan kicks in
    const MAX = 18 // px/frame at full push (~1000px/s at 60fps) — brisk but controllable
    const pointer = { x: 0, y: 0 }
    let selecting = false
    let raf = 0

    // Speed ramps 0→MAX across the band, with a slight ease-in so a gentle nudge creeps and a hard
    // push (or dragging past the edge) races — matching how Figma / Sheets feel.
    const speed = (depth: number) => MAX * Math.min(1, Math.max(0, depth) / EDGE) ** 1.5

    const emitMove = () => {
      // ReactFlow drives the selection box from an onMouseMove bound to the PANE element (it reads
      // clientX/clientY off the event). So dispatch the synthetic move straight ON the pane — not on
      // elementFromPoint, which mid-drag is usually the selection overlay and never bubbles to the
      // pane's handler. buttons:1 marks the left button as still held so it's treated as a live drag.
      const pane = domNode.querySelector('.react-flow__pane') ?? domNode
      const init = { clientX: pointer.x, clientY: pointer.y, bubbles: true, cancelable: true, buttons: 1, button: 0 }
      pane.dispatchEvent(new MouseEvent('mousemove', init))
    }

    const tick = () => {
      raf = 0
      if (!selecting) return
      const st = store.getState() as any
      const [tx, ty, zoom] = st.transform as [number, number, number]
      const width: number = st.width, height: number = st.height
      const r = domNode.getBoundingClientRect()
      const px = pointer.x - r.left, py = pointer.y - r.top
      let dx = 0, dy = 0
      if (px < EDGE) dx = -speed(EDGE - px)
      else if (px > width - EDGE) dx = speed(px - (width - EDGE))
      if (py < EDGE) dy = -speed(EDGE - py)
      else if (py > height - EDGE) dy = speed(py - (height - EDGE))
      if (dx || dy) {
        // dx>0 (near right) → reveal content to the right → translate LEFT (tx decreases), etc.
        let ntx = tx - dx, nty = ty - dy
        const b = boundsRef.current
        if (b) {
          // Keep the pan inside the same content+margin bounds the rest of the nav respects.
          const txLo = width - (b.maxX + PAN_PAD) * zoom, txHi = -(b.minX - PAN_PAD) * zoom
          const tyLo = height - (b.maxY + PAN_PAD) * zoom, tyHi = -(b.minY - PAN_PAD) * zoom
          ntx = Math.max(Math.min(txLo, txHi), Math.min(Math.max(txLo, txHi), ntx))
          nty = Math.max(Math.min(tyLo, tyHi), Math.min(Math.max(tyLo, tyHi), nty))
        }
        if (ntx !== tx || nty !== ty) {
          domNode.classList.add('flow-nav-zooming') // reuse the no-ease class so the pan tracks 1:1
          setViewport({ x: ntx, y: nty, zoom })
          emitMove() // grow the selection into the area we just scrolled in
        }
      }
      raf = requestAnimationFrame(tick)
    }

    const startTick = () => { if (!raf) raf = requestAnimationFrame(tick) }
    const stopTick = () => { if (raf) cancelAnimationFrame(raf); raf = 0; domNode.classList.remove('flow-nav-zooming') }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      // Only a drag that begins on the empty canvas is a selection — never on a node, edge, control,
      // minimap or our scrollbars.
      if (!t.closest('.react-flow__pane') || t.closest('.react-flow__node') || t.closest('.react-flow__edge') ||
        t.closest('.react-flow__controls') || t.closest('.react-flow__minimap') || t.closest('[role="scrollbar"]')) return
      selecting = true
      pointer.x = e.clientX; pointer.y = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      if (!e.isTrusted) return // ignore the moves WE synthesize, so we don't recurse
      pointer.x = e.clientX; pointer.y = e.clientY
      if (selecting) startTick()
    }
    const onUp = () => { selecting = false; stopTick() }

    domNode.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      stopTick()
      domNode.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [enabled, domNode, store, setViewport])
}

// The main hook. Call INSIDE a <ReactFlowProvider>. Spread `flowProps` onto <ReactFlow>; the
// caller keeps ownership of its own handlers, node/edge types and zoom limits.
export function useFlowNav(nodes: Node[], opts?: { marquee?: boolean }) {
  // "Touch device" here = a phone/TABLET where fingers are the input (view + drill, one-finger
  // pan, no node dragging). NOT a laptop that merely has a touchscreen — those must still drag
  // with their mouse/trackpad. So detect the OS, not raw touch capability: iPhone/Android, or an
  // iPad — which on iPadOS 13+ reports as a Mac with >1 touch points (a real Mac reports 0).
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent || ''
    const macLike = navigator.platform === 'MacIntel' || /Macintosh/i.test(ua)
    setIsTouch(/iPhone|iPad|iPod|Android/i.test(ua) || (macLike && (navigator.maxTouchPoints ?? 0) > 1))
  }, [])
  const marquee = !!opts?.marquee && !isTouch

  // Rubber-band selection auto-scrolls at the viewport edges (only in marquee mode).
  useMarqueeAutoPan(nodes, marquee)

  const bounds = useContentBounds(nodes)
  const paneW = useStore((s) => s.width)
  const paneH = useStore((s) => s.height)
  const zoom = useStore((s) => s.transform[2])
  const domNode = useStore((s) => s.domNode)
  const { setViewport } = useReactFlow()
  const store = useStoreApi()

  // Pinch zoom — we take it over entirely so we control the sensitivity (ReactFlow's default zooms
  // too little per pinch, so it took several gestures). A trackpad pinch (or ⌘/Ctrl+wheel) arrives
  // as a wheel event with ctrlKey set; we zoom toward the cursor and apply an amplified step. Plain
  // wheel (no ctrl) is left to ReactFlow for panning. Runs synchronously with no transition so it
  // tracks the pinch 1:1.
  const ZOOM_AMPLIFY = 4 // multiple of ReactFlow/d3's default zoom-per-tick; raise for more sensitivity
  useEffect(() => {
    if (!domNode) return
    let t: ReturnType<typeof setTimeout>
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // pinch / ⌘-Ctrl+wheel only — plain scroll pans (handled by ReactFlow)
      e.preventDefault(); e.stopPropagation() // own the zoom so ReactFlow doesn't also apply its (smaller) step
      const st = store.getState() as any
      const [tx, ty, z] = st.transform as [number, number, number]
      const minZoom: number = st.minZoom ?? 0.2, maxZoom: number = st.maxZoom ?? 2
      // Normalise the delta the same way d3 does (per deltaMode), then amplify.
      const perMode = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.002
      const next = Math.min(maxZoom, Math.max(minZoom, z * Math.pow(2, -e.deltaY * perMode * ZOOM_AMPLIFY)))
      if (next === z) return
      const r = domNode.getBoundingClientRect()
      const cx = e.clientX - r.left, cy = e.clientY - r.top
      const fx = (cx - tx) / z, fy = (cy - ty) / z // keep the flow point under the cursor fixed
      domNode.classList.add('flow-nav-zooming')
      setViewport({ x: cx - fx * next, y: cy - fy * next, zoom: next })
      clearTimeout(t)
      t = setTimeout(() => domNode.classList.remove('flow-nav-zooming'), 200)
    }
    domNode.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => { domNode.removeEventListener('wheel', onWheel, { capture: true } as any); clearTimeout(t) }
  }, [domNode, store, setViewport])

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
