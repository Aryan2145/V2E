'use client'

import React from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Folder, Square, GitBranch, Layers, Play, Flag } from 'lucide-react'
import type { ProcessNodeKind, ProcessNodeStatus, DiffChangeKind } from '@/lib/api/process-hierarchy'

export interface ProcessNodeData {
  name: string
  kind: ProcessNodeKind
  status: ProcessNodeStatus
  childCount: number
  drillable: boolean
  selected: boolean
  diff?: DiffChangeKind // when comparing versions — tints the node
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

export const KIND_META: Record<ProcessNodeKind, { label: string; icon: React.ReactNode; hint: string }> = {
  container: { label: 'Container', icon: <Folder size={14} />, hint: 'Groups other nodes — drill in' },
  task: { label: 'Task', icon: <Square size={14} />, hint: 'A single step in a flow' },
  decision: { label: 'Decision', icon: <GitBranch size={14} />, hint: 'A yes / no branch' },
  subprocess: { label: 'Sub-process', icon: <Layers size={14} />, hint: 'A step that opens a deeper flow' },
  start_event: { label: 'Start', icon: <Play size={14} />, hint: 'Where the flow begins' },
  end_event: { label: 'End', icon: <Flag size={14} />, hint: 'Where the flow ends' },
}

const STATUS_DOT: Record<ProcessNodeStatus, string> = {
  draft: '#94A3B8',
  in_review: '#D97706',
  final: '#16A34A',
}

const handleStyle: React.CSSProperties = { width: 8, height: 8, background: '#2563EB', border: '2px solid #fff' }

function Frame({ children, border }: { children: React.ReactNode; border: string }) {
  return (
    <div
      className="relative bg-white rounded-[10px] px-3 py-2 text-[13px] font-medium text-[#0F172A] shadow-sm"
      style={{ border: `2px solid ${border}`, minWidth: 150, maxWidth: 220 }}
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
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_DOT[data.status] }} title={data.status} />
    </div>
  )
}

function DrillBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-[#2563EB] text-white shadow">
      {count} inside
    </span>
  )
}

function StepNode({ data }: NodeProps<ProcessNodeData>) {
  const accent = data.kind === 'container' || data.kind === 'subprocess' ? '#3B82F6' : '#CBD5E1'
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Frame border={borderColor(data, accent)}>
        <TitleRow data={data} />
        <DrillBadge count={data.drillable ? data.childCount : 0} />
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
      <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] font-medium text-[#0F172A]">
        <span className="line-clamp-3">{data.name}</span>
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
