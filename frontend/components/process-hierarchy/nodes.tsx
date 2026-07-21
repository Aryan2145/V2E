'use client'

import React from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Play, Flag, ExternalLink, ChevronRight } from 'lucide-react'
import type { ProcessNodeKind, ProcessNodeStatus, DiffChangeKind } from '@/lib/api/process-hierarchy'
import { KIND_META } from './kind-meta'

export { KIND_META }

export interface ProcessNodeData {
  name: string
  kind: ProcessNodeKind
  status: ProcessNodeStatus
  childCount: number
  drillable: boolean
  selected: boolean
  diff?: DiffChangeKind // when comparing versions — tints the node
  linkedMapName?: string | null // cross-map link target
  onOpen?: () => void // drill into this node (container/sub-process/linked map)
}

const DIFF_COLOR: Partial<Record<DiffChangeKind, string>> = {
  added: '#16A34A',
  removed: '#DC2626',
  changed: '#D97706',
}

/** Border colour: selection wins, then a diff tint, else the kind accent. */
export function borderColor(data: ProcessNodeData, accent: string): string {
  if (data.selected) return '#2563EB'
  if (data.diff && DIFF_COLOR[data.diff]) return DIFF_COLOR[data.diff]!
  return accent
}

// Status pill styling per DESIGN_RULES status badges (readable label, not colour-only).
const STATUS_META: Record<ProcessNodeStatus, { label: string; dot: string; bg: string; text: string }> = {
  draft: { label: 'Draft', dot: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  in_review: { label: 'In review', dot: '#D97706', bg: '#FEF9C3', text: '#CA8A04' },
  final: { label: 'Final', dot: '#16A34A', bg: '#DCFCE7', text: '#16A34A' },
}

function StatusPill({ status }: { status: ProcessNodeStatus }) {
  const s = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0"
      style={{ background: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

const handleStyle: React.CSSProperties = { width: 8, height: 8, background: '#2563EB', border: '2px solid #fff' }

function Frame({ children, border }: { children: React.ReactNode; border: string }) {
  return (
    <div
      className="relative bg-white rounded-[10px] px-3 py-2 text-[13px] font-medium text-[#0F172A] shadow-sm"
      style={{ border: `2px solid ${border}`, minWidth: 160, maxWidth: 230 }}
    >
      {children}
    </div>
  )
}

function TitleRow({ data }: { data: ProcessNodeData }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: '#2563EB' }} className="shrink-0">{KIND_META[data.kind].icon}</span>
      <span className="truncate flex-1">{data.name}</span>
      <StatusPill status={data.status} />
    </div>
  )
}

/** Explicit, discoverable drill affordance (replaces the hidden double-click). */
function OpenButton({ data }: { data: ProcessNodeData }) {
  if (!data.onOpen) return null
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); data.onOpen!() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); data.onOpen!() } }}
      className="nodrag mt-1.5 w-full inline-flex items-center justify-center gap-1 rounded-[6px] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#2563EB] hover:text-white text-[11px] font-semibold py-1 transition-colors"
      aria-label={`Open ${data.name}${data.childCount ? ` (${data.childCount} inside)` : ''}`}
    >
      Open{data.childCount ? ` · ${data.childCount} inside` : ''} <ChevronRight size={12} />
    </button>
  )
}

function StepNode({ data }: NodeProps<ProcessNodeData>) {
  const accent = data.kind === 'container' || data.kind === 'subprocess' ? '#3B82F6' : '#CBD5E1'
  const canOpen = data.drillable || !!data.linkedMapName
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Frame border={borderColor(data, accent)}>
        <TitleRow data={data} />
        {data.linkedMapName && (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#2563EB]">
            <ExternalLink size={10} /> <span className="truncate">{data.linkedMapName}</span>
          </div>
        )}
        {canOpen && <OpenButton data={data} />}
      </Frame>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  )
}

function DecisionNode({ data }: NodeProps<ProcessNodeData>) {
  return (
    <div className="relative" style={{ width: 130, height: 130 }}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className="absolute inset-0 m-auto bg-white shadow-sm"
        style={{
          width: 92,
          height: 92,
          top: 19,
          left: 19,
          transform: 'rotate(45deg)',
          border: `2px solid ${borderColor(data, '#D97706')}`,
          borderRadius: 8,
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-[12px] font-medium text-[#0F172A] gap-1">
        <span className="line-clamp-3">{data.name}</span>
        <StatusPill status={data.status} />
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} id="yes" />
      <Handle type="source" position={Position.Bottom} style={handleStyle} id="no" />
    </div>
  )
}

function EventNode({ data }: NodeProps<ProcessNodeData>) {
  const isStart = data.kind === 'start_event'
  return (
    <>
      {!isStart && <Handle type="target" position={Position.Left} style={handleStyle} />}
      <div
        className="flex items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#0F172A] shadow-sm"
        style={{ width: 68, height: 68, border: `3px solid ${borderColor(data, isStart ? '#16A34A' : '#DC2626')}` }}
      >
        <span className="flex flex-col items-center gap-0.5" style={{ color: isStart ? '#16A34A' : '#DC2626' }}>
          {isStart ? <Play size={16} /> : <Flag size={16} />}
          <span className="text-[10px]">{isStart ? 'Start' : 'End'}</span>
        </span>
      </div>
      {isStart && <Handle type="source" position={Position.Right} style={handleStyle} />}
    </>
  )
}

function ProcessNodeRenderer(props: NodeProps<ProcessNodeData>) {
  if (props.data.kind === 'decision') return <DecisionNode {...props} />
  if (props.data.kind === 'start_event' || props.data.kind === 'end_event') return <EventNode {...props} />
  return <StepNode {...props} />
}

export const nodeTypes = { process: ProcessNodeRenderer }
