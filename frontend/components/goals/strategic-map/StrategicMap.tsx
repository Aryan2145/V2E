'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PERSPECTIVE_META, type Goal } from '@/lib/types/goals'
import { buildStrategyLayout } from './layout'
import { StrategyMapProvider, ObjectiveCard, GoalCard, SubGoalCard } from './nodes'

const CANVAS_H = 660
const TOOLBAR_H = 57

export default function StrategicMap({ goals }: { goals: Goal[] }) {
  const router = useRouter()
  const { addToast } = useToast()

  const [showAll, setShowAll] = useState(false)
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  const scrollRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const labelLayerRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(
    () => buildStrategyLayout(goals, { showAll, expandedGoals }),
    [goals, showAll, expandedGoals],
  )

  // Measure the scroll viewport so bands always fill at least the visible area
  // (no white gutters), even when the content is narrower than the canvas.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const wrapperWidth = Math.max(layout.contentWidth, viewport.w)
  const wrapperHeight = Math.max(layout.totalHeight, viewport.h)

  const onOpen = useCallback((goalId: string) => router.push(`/goals/${goalId}`), [router])
  const onToggle = useCallback((goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }, [])

  // Freeze the lane labels to the left edge: counter the horizontal scroll so they
  // stay pinned while everything else scrolls. (Vertical scroll moves them with
  // their lane, which is what we want.)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (el && labelLayerRef.current) {
      labelLayerRef.current.style.transform = `translateX(${el.scrollLeft}px)`
    }
  }, [])

  const handleExport = useCallback(async () => {
    if (!wrapperRef.current) return
    setExporting(true)
    const prevTransform = labelLayerRef.current?.style.transform ?? ''
    try {
      if (labelLayerRef.current) labelLayerRef.current.style.transform = 'translateX(0px)'
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(wrapperRef.current, {
        backgroundColor: '#ffffff',
        width: layout.contentWidth,
        height: layout.totalHeight,
        pixelRatio: 2,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = 'strategic-map.png'
      link.click()
    } catch {
      addToast('Could not export the image. Please try again.', 'error')
    } finally {
      if (labelLayerRef.current) labelLayerRef.current.style.transform = prevTransform
      setExporting(false)
    }
  }, [layout.contentWidth, layout.totalHeight, addToast])

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden"
      style={{ height: CANVAS_H }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] flex-wrap" style={{ height: TOOLBAR_H }}>
        <span className="text-sm font-semibold text-[#0F172A]">Strategy map</span>
        <span className="text-xs text-[#94A3B8] hidden md:inline">Scroll to navigate</span>

        <div className="hidden lg:flex items-center gap-3 ml-2">
          {(['financial', 'customer', 'internal_process', 'learning_growth'] as const).map((p) => (
            <span key={p} className="inline-flex items-center gap-1 text-[11px] text-[#64748B]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PERSPECTIVE_META[p].accent }} />
              {PERSPECTIVE_META[p].label}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-medium border transition-colors ${
              showAll
                ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#2563EB]'
                : 'bg-white border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1]'
            }`}
          >
            {showAll ? <Eye size={15} /> : <EyeOff size={15} />}
            {showAll ? 'Sub-goals shown' : 'Show sub-goals'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-medium bg-white border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>
      </div>

      {/* Scroll canvas — native scroll: the viewport moves, the diagram stays put. */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative overflow-auto" style={{ height: CANVAS_H - TOOLBAR_H }}>
        <StrategyMapProvider value={{ onOpen, onToggle }}>
          <div ref={wrapperRef} className="relative" style={{ width: wrapperWidth, height: wrapperHeight }}>
            {/* Lane bands (full-width, contiguous) */}
            {layout.lanes.map((lane) => (
              <div
                key={lane.key}
                className="absolute left-0"
                style={{ top: lane.top, height: lane.height, width: '100%', backgroundColor: lane.bg, borderBottom: '1px solid #E5EBF1' }}
              />
            ))}

            {/* Edges */}
            <svg
              className="absolute left-0 top-0 pointer-events-none"
              width={wrapperWidth}
              height={layout.totalHeight}
              style={{ zIndex: 5 }}
            >
              {layout.edges.map((e) => {
                const midY = (e.y1 + e.y2) / 2
                return (
                  <path
                    key={e.id}
                    d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY} ${e.x2} ${midY} ${e.x2} ${e.y2}`}
                    fill="none"
                    stroke={e.color}
                    strokeWidth={2}
                    strokeOpacity={0.55}
                  />
                )
              })}
            </svg>

            {/* Cards */}
            {layout.cards.map((c) => (
              <div key={c.id} className="absolute" style={{ left: c.x, top: c.y, width: c.w, height: c.h, zIndex: 10 }}>
                {c.kind === 'objective' && <ObjectiveCard goal={c.goal} goalCount={c.goalCount ?? 0} />}
                {c.kind === 'goal' && (
                  <GoalCard goal={c.goal} subCount={c.subCount ?? 0} expanded={!!c.expanded} toggleable={!!c.toggleable} />
                )}
                {c.kind === 'subgoal' && <SubGoalCard goal={c.goal} crossPerspective={!!c.crossPerspective} />}
              </div>
            ))}

            {/* Frozen lane labels (pinned to the left edge) */}
            <div ref={labelLayerRef} className="absolute left-0 top-0" style={{ width: layout.labelWidth, height: layout.totalHeight, zIndex: 30, willChange: 'transform' }}>
              {layout.lanes.map((lane) => (
                <div
                  key={lane.key}
                  className="absolute left-0 flex items-center pl-5 pr-3"
                  style={{ top: lane.top, height: lane.height, width: layout.labelWidth, backgroundColor: lane.bg, boxShadow: '1px 0 0 #E5EBF1' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-11 rounded-full shrink-0" style={{ backgroundColor: lane.accent }} />
                    <div>
                      <p className="text-[13px] font-bold uppercase tracking-wide leading-tight" style={{ color: lane.text }}>
                        {lane.label}
                      </p>
                      {lane.sublabel && <p className="text-[11px] text-[#94A3B8] mt-0.5">{lane.sublabel}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </StrategyMapProvider>
      </div>
    </div>
  )
}
