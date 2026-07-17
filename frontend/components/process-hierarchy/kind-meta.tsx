// Pure node-kind metadata (labels / icons / hints).
// Deliberately free of any `reactflow` import so pages and drawers can use it
// without dragging the whole canvas library into their server/SSR bundle.
import React from 'react'
import { Folder, Square, GitBranch, Layers, Play, Flag } from 'lucide-react'
import type { ProcessNodeKind } from '@/lib/api/process-hierarchy'

export const KIND_META: Record<ProcessNodeKind, { label: string; icon: React.ReactNode; hint: string }> = {
  container: { label: 'Container', icon: <Folder size={14} />, hint: 'Groups other nodes — drill in' },
  task: { label: 'Task', icon: <Square size={14} />, hint: 'A single step in a flow' },
  decision: { label: 'Decision', icon: <GitBranch size={14} />, hint: 'A yes / no branch' },
  subprocess: { label: 'Sub-process', icon: <Layers size={14} />, hint: 'A step that opens a deeper flow' },
  start_event: { label: 'Start', icon: <Play size={14} />, hint: 'Where the flow begins' },
  end_event: { label: 'End', icon: <Flag size={14} />, hint: 'Where the flow ends' },
}
