'use client'

import React from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Play, Flag, ExternalLink, ChevronRight, Pencil, FileText, Maximize2, Minimize2, Folder, Link2, StickyNote } from 'lucide-react'
import type { ProcessNodeKind, DiffChangeKind, ProcessArtifactContentType } from '@/lib/api/process-hierarchy'
import { KIND_META } from './kind-meta'

export { KIND_META }

export interface ProcessNodeData {
  name: string
  kind: ProcessNodeKind
  childCount: number
  docCount?: number // input + output documents attached to this node
  drillable: boolean
  selected: boolean
  diff?: DiffChangeKind // when comparing versions — tints the node
  linkedMapName?: string | null // cross-map link target
  onEdit?: () => void // open the side panel to edit this node's details (pencil)
  canExpand?: boolean // references a map → can be unfolded in place
  onToggleExpand?: () => void // expand/collapse this area inline
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

const handleStyle: React.CSSProperties = { width: 7, height: 7, background: '#2563EB', border: '2px solid #fff' }

/** Small top-right pencil — opens the side panel to edit this node's details.
    Stops propagation so it never triggers the node's click-to-enter. */
function EditButton({ data }: { data: ProcessNodeData }) {
  if (!data.onEdit) return null
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); data.onEdit!() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); data.onEdit!() } }}
      className="nodrag absolute top-1 right-1 w-5 h-5 inline-flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
      aria-label={`Edit ${data.name}`}
      title="Edit details"
    >
      <Pencil size={12} />
    </button>
  )
}

function StepNode({ data }: NodeProps<ProcessNodeData>) {
  const isContainer = data.kind === 'container'
  const accent = data.kind === 'container' || data.kind === 'subprocess' ? '#3B82F6' : '#CBD5E1'
  const canOpen = data.drillable || !!data.linkedMapName
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className={`relative bg-white rounded-[8px] px-2.5 py-1.5 shadow-sm flex flex-col justify-center ${canOpen ? 'cursor-pointer' : ''}`}
        style={{ border: `2px solid ${borderColor(data, accent)}`, width: isContainer ? 220 : 170, minHeight: isContainer ? 88 : 60 }}
      >
        {/* Drillable nodes: pencil edits; the body itself opens the level. */}
        {canOpen && <EditButton data={data} />}
        {data.canExpand && (
          <button type="button" onClick={(e) => { e.stopPropagation(); data.onToggleExpand?.() }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); data.onToggleExpand?.() } }}
            className="nodrag absolute top-1 right-7 w-5 h-5 inline-flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            aria-label="Expand in place" title="Expand in place">
            <Maximize2 size={11} />
          </button>
        )}
        <div className={`flex items-start gap-1.5 ${data.canExpand ? 'pr-11' : canOpen ? 'pr-5' : ''}`}>
          <span style={{ color: '#2563EB' }} className="shrink-0 mt-0.5">{KIND_META[data.kind].icon}</span>
          <span className="flex-1 min-w-0 text-[13px] font-medium text-[#0F172A] leading-snug break-words">{data.name}</span>
        </div>
        {data.linkedMapName && data.linkedMapName !== data.name && (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#2563EB]">
            <ExternalLink size={10} /> <span className="truncate">{data.linkedMapName}</span>
          </div>
        )}
        {(canOpen || !!data.docCount) && (
          <div className="mt-1 flex items-center gap-2">
            {!!data.docCount && (
              <button onClick={(e) => { e.stopPropagation(); data.onEdit?.() }}
                className="nodrag inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#475569] hover:text-[#2563EB]"
                title={`${data.docCount} document${data.docCount > 1 ? 's' : ''}`}>
                <FileText size={11} /> {data.docCount}
              </button>
            )}
            {canOpen && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#2563EB]">
                {data.childCount ? `${data.childCount} inside` : 'Open'} <ChevronRight size={11} />
              </span>
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </>
  )
}

function DecisionNode({ data }: NodeProps<ProcessNodeData>) {
  return (
    <div className="relative" style={{ width: 96, height: 96 }}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className="absolute bg-white shadow-sm"
        style={{
          width: 66,
          height: 66,
          top: 15,
          left: 15,
          transform: 'rotate(45deg)',
          border: `2px solid ${borderColor(data, '#D97706')}`,
          borderRadius: 6,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-3 text-center">
        <span className="line-clamp-3 text-[10px] font-medium text-[#0F172A] leading-tight">{data.name}</span>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} id="yes" />
      <Handle type="source" position={Position.Bottom} style={handleStyle} id="no" />
    </div>
  )
}

function EventNode({ data }: NodeProps<ProcessNodeData>) {
  const isStart = data.kind === 'start_event'
  const accent = isStart ? '#16A34A' : '#DC2626'
  return (
    <>
      {!isStart && <Handle type="target" position={Position.Left} style={handleStyle} />}
      {/* 44px circle keeps the node bounds (so handles stay centered); the label is
          absolutely positioned below so you can read it on the canvas. */}
      <div
        className="relative flex items-center justify-center rounded-full bg-white shadow-sm"
        style={{ width: 44, height: 44, border: `3px solid ${borderColor(data, accent)}`, color: accent }}
        title={data.name}
        aria-label={data.name}
      >
        {isStart ? <Play size={18} /> : <Flag size={18} />}
        <span className="absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 w-[120px] text-center text-[11px] font-semibold leading-tight break-words pointer-events-none"
          style={{ color: accent }}>
          {data.name}
        </span>
      </div>
      {isStart && <Handle type="source" position={Position.Right} style={handleStyle} />}
    </>
  )
}

// ─── Band: an area unfolded in place. Sized by the canvas to hold its children,
// which render as child nodes inside it (ReactFlow parent/extent). ────────────
function BandNode({ data }: NodeProps<ProcessNodeData>) {
  return (
    <div className="w-full h-full rounded-[12px] border-2 border-[#3B82F6] bg-[#EFF6FF]/40 shadow-sm">
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div className="absolute top-0 left-0 right-0 h-7 flex items-center gap-1.5 px-2 bg-[#EFF6FF] border-b border-[#BFDBFE] rounded-t-[10px]">
        <Folder size={13} className="text-[#2563EB] shrink-0" />
        <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-[#0F172A]">{data.name}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); data.onToggleExpand?.() }}
          className="nodrag shrink-0 w-5 h-5 inline-flex items-center justify-center rounded text-[#64748B] hover:text-[#0F172A] hover:bg-white"
          aria-label="Collapse" title="Collapse"><Minimize2 size={12} /></button>
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  )
}

function ProcessNodeRenderer(props: NodeProps<ProcessNodeData>) {
  if (props.data.kind === 'decision') return <DecisionNode {...props} />
  if (props.data.kind === 'start_event' || props.data.kind === 'end_event') return <EventNode {...props} />
  return <StepNode {...props} />
}

// ─── Document chip: a clickable input/output document hanging off a node by its own
// dotted line. Inputs sit above (line comes down into the node), outputs below. ──
export interface DocNodeData {
  name: string
  contentType: ProcessArtifactContentType
  io: 'input' | 'output'
  onOpen: () => void
}
export const DOC_CHIP_W = 150
export const DOC_CHIP_H = 30

function DocNode({ data }: NodeProps<DocNodeData>) {
  const Icon = data.contentType === 'link' ? Link2 : data.contentType === 'article' ? StickyNote : FileText
  const isInput = data.io === 'input'
  return (
    <>
      {/* One handle on the side facing the node, so the dotted line meets it cleanly. */}
      <Handle type="source" position={isInput ? Position.Bottom : Position.Top} style={{ opacity: 0 }} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); data.onOpen() }}
        title={`${isInput ? 'Input' : 'Output'} document — ${data.name}`}
        style={{ width: DOC_CHIP_W, height: DOC_CHIP_H }}
        className="nodrag group flex items-center gap-1.5 px-2 rounded-[7px] border border-dashed border-[#CBD5E1] bg-white shadow-sm text-left transition-colors hover:border-[#2563EB]"
      >
        <span className="w-[3px] self-stretch my-1 rounded-full shrink-0" style={{ background: isInput ? '#0EA5E9' : '#8B5CF6' }} />
        <Icon size={13} className="shrink-0" style={{ color: isInput ? '#0EA5E9' : '#8B5CF6' }} />
        <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-[#334155] group-hover:text-[#0F172A]">{data.name}</span>
      </button>
    </>
  )
}

export const nodeTypes = { process: ProcessNodeRenderer, band: BandNode, document: DocNode }
