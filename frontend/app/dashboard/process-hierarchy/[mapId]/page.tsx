'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import StyledSelect from '@/components/ui/StyledSelect'
import {
  processHierarchyApi,
  type FlowLevel,
  type ProcessMapDetail,
  type ProcessNodeKind,
  type ProcessConditionKind,
  type SnapshotSummary,
  type MapDiff,
  type TreeNode,
  type ProcessMapSummary,
  type ProcessArtifact,
} from '@/lib/api/process-hierarchy'
import dynamic from 'next/dynamic'
import NodeDrawer from '@/components/process-hierarchy/NodeDrawer'
import { MaterialPreviewModal } from '@/components/process-hierarchy/node-materials'
import ArtifactLibrary from '@/components/process-hierarchy/ArtifactLibrary'
import HierarchyTree from '@/components/process-hierarchy/HierarchyTree'
import { KIND_META } from '@/components/process-hierarchy/kind-meta'
import { autoLayout } from '@/components/process-hierarchy/layout'

// Client-only: keeps ReactFlow + html-to-image out of this route's server/SSR bundle.
const ProcessCanvas = dynamic(() => import('@/components/process-hierarchy/ProcessCanvas'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})
import {
  Eye, Pencil, Filter, History, Plus, Check, X, Loader2, RotateCcw,
  GitCompare, FolderOpen, Save, MoreHorizontal, PanelLeft, Lightbulb, Trash2,
  Link2 as LinkIcon, Search, Workflow, ClipboardPaste,
} from 'lucide-react'

const ADD_KINDS: ProcessNodeKind[] = ['task', 'decision', 'subprocess', 'container', 'start_event', 'end_event']
const HINT_KEY = 'ph.explorer.hintDismissed'

export default function ProcessMapExplorerPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const orgId = user?.organizationId ?? ''
  const params = useParams()
  const router = useRouter()
  const mapId = String(params.mapId)

  const [map, setMap] = useState<ProcessMapDetail | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [flow, setFlow] = useState<FlowLevel | null>(null)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [visible, setVisible] = useState<Set<string> | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showRefPicker, setShowRefPicker] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showDeleteMap, setShowDeleteMap] = useState(false)
  const [deletingMap, setDeletingMap] = useState(false)
  const [showTree, setShowTree] = useState(false) // outline is now a slide-over; closed by default
  const [modeInitialized, setModeInitialized] = useState(false)
  const [diff, setDiff] = useState<MapDiff | null>(null)
  const [comparing, setComparing] = useState<{ base: string; target: string; baseLabel: string; targetLabel: string } | null>(null)
  // The on-canvas hint toast; dismissal is remembered per user (local preference).
  const [hintDismissed, setHintDismissed] = useState(true)
  const [docPreview, setDocPreview] = useState<ProcessArtifact | null>(null)
  const spawnCenterRef = useRef<(() => { x: number; y: number }) | null>(null)
  // Clipboard lives in sessionStorage so it survives navigating to another map — that's
  // the whole point of "copy here, open a different map, paste there".
  const [clipboard, setClipboardState] = useState<{ sourceMapId: string; nodeIds: string[] } | null>(null)
  useEffect(() => {
    try { const raw = sessionStorage.getItem('ph-clipboard'); if (raw) setClipboardState(JSON.parse(raw)) } catch {}
  }, [])
  const setClipboard = useCallback((c: { sourceMapId: string; nodeIds: string[] } | null) => {
    setClipboardState(c)
    try { if (c) sessionStorage.setItem('ph-clipboard', JSON.stringify(c)); else sessionStorage.removeItem('ph-clipboard') } catch {}
  }, [])
  useEffect(() => {
    try { setHintDismissed(localStorage.getItem(HINT_KEY) === '1') } catch { setHintDismissed(false) }
  }, [])
  const dismissHint = useCallback(() => {
    setHintDismissed(true)
    try { localStorage.setItem(HINT_KEY, '1') } catch { /* ignore */ }
  }, [])
  const showHint = useCallback(() => {
    setHintDismissed(false)
    try { localStorage.removeItem(HINT_KEY) } catch { /* ignore */ }
  }, [])

  const loadTree = useCallback(() => {
    processHierarchyApi.getTree(orgId, mapId).then((t) => setTree(t.nodes)).catch(() => {})
  }, [orgId, mapId])

  const loadFlow = useCallback(async (pid: string | null) => {
    const f = await processHierarchyApi.getFlow(orgId, mapId, pid)
    setFlow(f)
    setVisible(null) // reset visibility filter on level change
    return f
  }, [orgId, mapId])

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    Promise.all([processHierarchyApi.getMap(orgId, mapId), processHierarchyApi.getFlow(orgId, mapId, null)])
      .then(([m, f]) => {
        setMap(m)
        setFlow(f)
        loadTree()
        if (!modeInitialized) { setMode(f.can_edit ? 'edit' : 'view'); setModeInitialized(true) }
      })
      .catch(() => router.push('/dashboard/process-hierarchy'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mapId])

  // Reload the current level and refresh the outline tree after any structural change.
  const refresh = useCallback(async () => { await loadFlow(parentId); loadTree() }, [loadFlow, parentId, loadTree])

  const drill = useCallback(async (nodeId: string) => {
    const node = flow?.nodes.find((n) => n.id === nodeId)
    if (node?.linked_map_id) { router.push(`/dashboard/process-hierarchy/${node.linked_map_id}`); return }
    setSelectedNodeId(null)
    setParentId(nodeId)
    await loadFlow(nodeId)
  }, [flow, loadFlow, router])

  const goTo = useCallback(async (pid: string | null) => {
    setSelectedNodeId(null)
    setParentId(pid)
    await loadFlow(pid)
  }, [loadFlow])

  // From the tree: open a level (container) or jump to a node and select it.
  const openTreeLevel = useCallback((pid: string | null) => { goTo(pid) }, [goTo])
  const openTreeNode = useCallback(async (node: TreeNode) => {
    await goTo(node.parent_node_id)
    setSelectedNodeId(node.id)
  }, [goTo])

  const canEditHere = !comparing && mode === 'edit' && !!flow?.can_edit

  // Core: place a node in the flow (anchor on selected/right-most, auto-connect), with
  // optional composition (build-in-place child map, or reference an existing map).
  const spawnNode = useCallback(async (kind: ProcessNodeKind, opts?: { name?: string; linkedMapId?: string; createLinkedMap?: boolean }) => {
    if (!flow) return
    setShowAdd(false)
    // Anchor ONLY on a node you've selected. With nothing selected we drop the new node
    // where you're currently looking (centre of the visible canvas) instead of appending
    // it to the far end of the flow, off-screen.
    const anchor = selectedNodeId ? flow.nodes.find((nd) => nd.id === selectedNodeId) ?? null : null
    const center = anchor ? null : (spawnCenterRef.current?.() ?? null)
    let tx = anchor ? anchor.position_x + 240 : Math.round(center?.x ?? 80)
    let ty = anchor ? anchor.position_y : Math.round(center?.y ?? 80)
    const occupied = (x: number, y: number) => flow.nodes.some((nd) => Math.abs(nd.position_x - x) < 60 && Math.abs(nd.position_y - y) < 50)
    for (let i = 0; occupied(tx, ty) && i < 20; i++) ty += 140

    try {
      const created = await processHierarchyApi.createNode(orgId, mapId, {
        parent_node_id: parentId, kind,
        name: opts?.name ?? `New ${KIND_META[kind].label}`,
        position_x: tx, position_y: ty,
        ...(opts?.createLinkedMap ? { create_linked_map: true } : {}),
        ...(opts?.linkedMapId ? { linked_map_id: opts.linkedMapId } : {}),
      })
      // Wire it straight into the flow only when continuing from a selected node (skip if
      // that node is an End marker or the new node is a Start marker). A node dropped into
      // empty space stays standalone — drag/connect it yourself.
      if (anchor && anchor.kind !== 'end_event' && kind !== 'start_event') {
        const condition: ProcessConditionKind = anchor.kind === 'decision' ? 'yes' : 'none'
        await processHierarchyApi.createConnection(orgId, mapId, {
          parent_node_id: parentId, source_node_id: anchor.id, target_node_id: created.id,
          condition_kind: condition, label: condition === 'yes' ? 'Yes' : undefined,
        }).catch(() => {})
      }
      await refresh()
      setSelectedNodeId(created.id) // highlight + open the panel, so it's obvious it landed
    } catch { addToast('Could not add that step. Please try again.', 'error') }
  }, [flow, orgId, mapId, parentId, selectedNodeId, refresh, addToast])

  // Copy/paste. Copy just remembers what's on the clipboard; paste duplicates it into
  // the level you're viewing, dropped where you're looking (centre of the canvas).
  const copyNodes = useCallback((nodeIds: string[]) => {
    const ids = nodeIds.filter((id) => !id.includes('::')) // only real top-level nodes
    if (!ids.length) return
    setClipboard({ sourceMapId: mapId, nodeIds: ids })
    addToast(`Copied ${ids.length} item${ids.length !== 1 ? 's' : ''}. Paste from the Add menu.`, 'success')
  }, [mapId, addToast])

  const pasteClipboard = useCallback(async () => {
    if (!clipboard) return
    setShowAdd(false)
    const c = spawnCenterRef.current?.() ?? null
    try {
      const { pasted_node_ids } = await processHierarchyApi.pasteNodes(orgId, mapId, {
        source_map_id: clipboard.sourceMapId, node_ids: clipboard.nodeIds,
        parent_node_id: parentId,
        ...(c ? { position_x: Math.round(c.x), position_y: Math.round(c.y) } : {}),
      })
      await refresh()
      if (pasted_node_ids[0]) setSelectedNodeId(pasted_node_ids[0])
      addToast(`Pasted ${pasted_node_ids.length} item${pasted_node_ids.length !== 1 ? 's' : ''}.`, 'success')
    } catch (e: any) { addToast(e?.response?.data?.message ?? 'Could not paste here.', 'error') }
  }, [clipboard, orgId, mapId, parentId, refresh, addToast])

  // Build-in-place: containers / sub-processes instantly become their own child map.
  const addNode = useCallback((kind: ProcessNodeKind) => {
    const isArea = kind === 'container' || kind === 'subprocess'
    return spawnNode(kind, { createLinkedMap: isArea })
  }, [spawnNode])

  // Insert a reference (instance) to an existing map.
  const addReference = useCallback((map: { id: string; name: string }) => {
    setShowRefPicker(false)
    return spawnNode('subprocess', { name: map.name, linkedMapId: map.id })
  }, [spawnNode])

  const onConnect = useCallback(async (source: string, target: string, condition: ProcessConditionKind) => {
    try {
      await processHierarchyApi.createConnection(orgId, mapId, {
        parent_node_id: parentId, source_node_id: source, target_node_id: target,
        condition_kind: condition, label: condition === 'yes' ? 'Yes' : condition === 'no' ? 'No' : undefined,
      })
      await loadFlow(parentId)
    } catch { addToast('Could not connect those steps.', 'error') }
  }, [orgId, mapId, parentId, loadFlow, addToast])

  const onNodeDragStop = useCallback(async (nodeId: string, x: number, y: number) => {
    // Update local state too, so a later expand/collapse rebuilds at the new spot
    // (not the stale stored position) — otherwise the node appears to jump.
    setFlow((f) => f ? { ...f, nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, position_x: x, position_y: y } : n)) } : f)
    await processHierarchyApi.bulkPosition(orgId, mapId, [{ id: nodeId, position_x: x, position_y: y }])
      .catch(() => addToast('Could not save the new position.', 'error'))
  }, [orgId, mapId, addToast])

  // Open a document clicked straight on the canvas: links jump out, files/articles preview.
  const openDoc = useCallback(async (artifactId: string) => {
    try {
      const a = await processHierarchyApi.getArtifact(orgId, mapId, artifactId)
      if (a.content_type === 'link' && a.url) { window.open(a.url, '_blank', 'noopener'); return }
      setDocPreview(a)
    } catch { addToast('Could not open this document.', 'error') }
  }, [orgId, mapId, addToast])
  const downloadDoc = useCallback(async (a: ProcessArtifact) => {
    try { const { url } = await processHierarchyApi.downloadArtifact(orgId, mapId, a.id); window.open(url, '_blank', 'noopener') }
    catch { addToast('Could not download this file.', 'error') }
  }, [orgId, mapId, addToast])

  // Box-selected group dragged to a new spot — persist every moved node's position.
  const onNodesMove = useCallback(async (positions: { id: string; position_x: number; position_y: number }[]) => {
    if (!positions.length) return
    setFlow((f) => f ? { ...f, nodes: f.nodes.map((n) => {
      const p = positions.find((x) => x.id === n.id)
      return p ? { ...n, position_x: p.position_x, position_y: p.position_y } : n
    }) } : f)
    await processHierarchyApi.bulkPosition(orgId, mapId, positions).catch(() => addToast('Could not save the new positions.', 'error'))
  }, [orgId, mapId, addToast])

  // Delete a box-selected group (cascades handled server-side; ignore per-node races).
  const deleteNodes = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    setSelectedNodeId(null)
    await Promise.allSettled(ids.map((id) => processHierarchyApi.deleteNode(orgId, mapId, id)))
    await refresh()
  }, [orgId, mapId, refresh])

  // Delete the entire map (owner only) — returns to the maps list on success.
  const deleteMap = useCallback(async () => {
    setDeletingMap(true)
    try {
      await processHierarchyApi.deleteMap(orgId, mapId)
      router.push('/dashboard/process-hierarchy')
    } catch { addToast('Could not delete this map. Please try again.', 'error'); setDeletingMap(false) }
  }, [orgId, mapId, router, addToast])

  const runAutoLayout = useCallback(async () => {
    if (!flow) return
    const pos = autoLayout(flow.nodes, flow.connections)
    const updates = flow.nodes.filter((n) => pos[n.id]).map((n) => ({ id: n.id, position_x: pos[n.id].x, position_y: pos[n.id].y }))
    if (!updates.length) return
    setFlow({ ...flow, nodes: flow.nodes.map((n) => (pos[n.id] ? { ...n, position_x: pos[n.id].x, position_y: pos[n.id].y } : n)) })
    await processHierarchyApi.bulkPosition(orgId, mapId, updates).catch(() => addToast('Could not save the layout.', 'error'))
  }, [flow, orgId, mapId, addToast])

  const updateConn = useCallback(async (id: string, dto: { label?: string; condition_kind?: ProcessConditionKind }) => {
    try { await processHierarchyApi.updateConnection(orgId, mapId, id, dto); await loadFlow(parentId) }
    catch { addToast('Could not update the connection.', 'error') }
  }, [orgId, mapId, parentId, loadFlow, addToast])

  const deleteConn = useCallback(async (id: string) => {
    try { await processHierarchyApi.deleteConnection(orgId, mapId, id); await loadFlow(parentId) }
    catch { addToast('Could not delete the connection.', 'error') }
  }, [orgId, mapId, parentId, loadFlow, addToast])

  const runCompare = useCallback(async (base: string, target: string, baseLabel: string, targetLabel: string) => {
    try {
      const d = await processHierarchyApi.diff(orgId, mapId, base, target)
      setDiff(d); setComparing({ base, target, baseLabel, targetLabel })
      setShowVersions(false); setMode('view'); setSelectedNodeId(null)
    } catch { addToast('Could not compare those versions.', 'error') }
  }, [orgId, mapId, addToast])

  const exitCompare = useCallback(() => { setDiff(null); setComparing(null) }, [])

  const jumpTo = useCallback(async (parentNodeId: string | null, nodeId: string | null, removed: boolean) => {
    await goTo(parentNodeId)
    if (nodeId && !removed) setSelectedNodeId(nodeId)
  }, [goTo])

  if (loading || !map || !flow) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Floating "Add step" primary — rendered over the canvas (top-right cluster).
  const addStepControl = canEditHere ? (
    <div className="relative">
      <button onClick={() => setShowAdd((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-[8px] bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1">
        <Plus size={14} /> Add step
      </button>
      {showAdd && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAdd(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg p-1.5 animate-[popIn_.12s_ease-out]">
            {ADD_KINDS.map((k) => (
              <button key={k} onClick={() => addNode(k)}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[8px] hover:bg-[#F1F5F9] text-left transition-colors">
                <span className="text-[#2563EB] mt-0.5">{KIND_META[k].icon}</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-[#0F172A]">{KIND_META[k].label}</span>
                  <span className="block text-[11px] text-[#64748B]">{KIND_META[k].hint}</span>
                </span>
              </button>
            ))}
            <div className="my-1 border-t border-[#F1F5F9]" />
            <button onClick={() => { setShowAdd(false); setShowRefPicker(true) }}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[8px] hover:bg-[#F1F5F9] text-left transition-colors">
              <span className="text-[#2563EB] mt-0.5"><LinkIcon size={14} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-[#0F172A]">Reference a map</span>
                <span className="block text-[11px] text-[#64748B]">Drop an instance of an existing map</span>
              </span>
            </button>
            {clipboard && (
              <button onClick={pasteClipboard}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[8px] hover:bg-[#F1F5F9] text-left transition-colors">
                <span className="text-[#2563EB] mt-0.5"><ClipboardPaste size={14} /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-[#0F172A]">Paste {clipboard.nodeIds.length} item{clipboard.nodeIds.length !== 1 ? 's' : ''}</span>
                  <span className="block text-[11px] text-[#64748B]">Drop a copy of what you copied here</span>
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  ) : null

  return (
    // Full-height flex column that sits flush under the fixed global nav. The negative
    // margins cancel the shared dashboard page padding (px/py) for THIS route only —
    // see app/dashboard/layout.tsx — then we re-add tight gutters. Canvas pans; the
    // page itself never scrolls.
    <div className="flex flex-col overflow-hidden h-[calc(100dvh-56px)] -mt-6 lg:-mt-8 -mb-6 lg:-mb-8 -mx-4 sm:-mx-6 lg:-mx-8 px-3 lg:px-4 pt-2 pb-2">
      {/* Single header bar — breadcrumb (left) + working controls (right). ~44px; may wrap on mobile. */}
      <div className="flex flex-wrap items-center gap-2 min-h-[44px] shrink-0">
        {/* Breadcrumb — the last crumb is the title. Scrolls horizontally, never wraps. */}
        <nav aria-label="Breadcrumb"
          className="flex items-center gap-1.5 min-w-0 flex-1 text-[13px] text-[#64748B] overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          <button onClick={() => router.push('/dashboard/process-hierarchy')}
            className="inline-flex items-center shrink-0 font-medium text-[#475569] hover:text-[#2563EB] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]">
            All maps
          </button>
          <span className="text-[#CBD5E1]">›</span>
          <button onClick={() => goTo(null)}
            className={`shrink-0 font-medium hover:text-[#2563EB] max-w-[180px] truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${parentId === null && flow.breadcrumb.length === 0 ? 'text-[#0F172A] font-semibold' : ''}`}>
            {map.name}
          </button>
          {flow.breadcrumb.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[#CBD5E1]">›</span>
              {i < flow.breadcrumb.length - 1
                ? <button onClick={() => goTo(c.id)} className="font-medium hover:text-[#2563EB] max-w-[160px] truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]">{c.name}</button>
                : <span className="font-semibold text-[#0F172A] max-w-[220px] truncate" aria-current="page">{c.name}</span>}
            </span>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Outline slide-over toggle */}
          <button onClick={() => setShowTree((v) => !v)} title={showTree ? 'Hide outline' : 'Show outline'} aria-pressed={showTree}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium rounded-[8px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 ${showTree ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F1F5F9]'}`}>
            <PanelLeft size={14} /> <span className="hidden md:inline">Outline</span>
          </button>

          {map.can_edit && (
            <div className="inline-flex h-8 rounded-[8px] border border-[#E2E8F0] overflow-hidden">
              <button onClick={() => setMode('view')} title="View"
                className={`inline-flex items-center gap-1.5 px-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] ${mode === 'view' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F1F5F9]'}`}>
                <Eye size={14} /> <span className="hidden md:inline">View</span>
              </button>
              <button onClick={() => setMode('edit')} title="Edit"
                className={`inline-flex items-center gap-1.5 px-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] ${mode === 'edit' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F1F5F9]'}`}>
                <Pencil size={14} /> <span className="hidden md:inline">Edit</span>
              </button>
            </div>
          )}

          {/* Visibility filter */}
          <div className="relative">
            <button onClick={() => setShowFilter((v) => !v)} title={visible ? `Showing ${visible.size}` : 'View all'}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium rounded-[8px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 ${visible ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F1F5F9]'}`}>
              <Filter size={14} /> <span className="hidden md:inline">{visible ? `Showing ${visible.size}` : 'Filter'}</span>
            </button>
            {showFilter && (
              <VisibilityPanel flow={flow} visible={visible} onChange={setVisible} onClose={() => setShowFilter(false)} />
            )}
          </div>

          {/* More (secondary tools) + Versions popover anchor */}
          <div className="relative">
            <button onClick={() => setShowMore((v) => !v)} title="More"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium rounded-[8px] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1">
              <MoreHorizontal size={14} /> <span className="hidden md:inline">More</span>
            </button>
            {showMore && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg p-1.5 animate-[popIn_.12s_ease-out]">
                  <MenuItem icon={<History size={15} />} label="Versions & compare" onClick={() => { setShowMore(false); setShowVersions(true) }} />
                  {map.can_edit && <MenuItem icon={<FolderOpen size={15} />} label="Document library" onClick={() => { setShowMore(false); setShowDocs(true) }} />}
                  <MenuItem icon={<Save size={15} />} label="Save as template" onClick={() => { setShowMore(false); setShowSaveTpl(true) }} />
                  {hintDismissed && <MenuItem icon={<Lightbulb size={15} />} label="Show tips" onClick={() => { setShowMore(false); showHint() }} />}
                  {map.is_owner && (
                    <>
                      <div className="my-1 h-px bg-[#F1F5F9]" />
                      <MenuItem icon={<Trash2 size={15} />} label="Delete this map" danger onClick={() => { setShowMore(false); setShowDeleteMap(true) }} />
                    </>
                  )}
                </div>
              </>
            )}
            {showVersions && (
              <VersionsPanel orgId={orgId} mapId={mapId} canEdit={map.can_edit}
                onClose={() => setShowVersions(false)} onRestored={() => refresh()} onCompare={runCompare} />
            )}
          </div>
        </div>
      </div>

      {/* Compare banner */}
      {comparing && diff && (
        <div className="flex items-center gap-3 flex-wrap rounded-[10px] bg-[#0F172A] text-white px-4 py-2.5 mt-2 shrink-0">
          <GitCompare size={16} className="shrink-0" />
          <span className="text-[13px] font-medium">
            Comparing <span className="font-semibold">{comparing.baseLabel}</span> → <span className="font-semibold">{comparing.targetLabel}</span>
          </span>
          <span className="text-[12px] text-white/70">{diff.summary.total_changes} change{diff.summary.total_changes !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" /> added</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> changed</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> removed</span>
          </span>
          <button onClick={exitCompare} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-white/90 hover:text-white">
            <X size={14} /> Exit compare
          </button>
        </div>
      )}

      {/* Canvas — takes the full remaining area, inset with a light border + rounded corners.
          Everything else (outline, add, hint) floats over it. */}
      <div className="relative flex-1 min-h-0 mt-2 rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
        {flow.nodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
              {KIND_META.start_event.icon}
            </div>
            <p className="text-[#0F172A] font-semibold">This level is empty</p>
            <p className="text-[#475569] text-sm mt-1 max-w-sm">
              {canEditHere ? 'Add a Start marker and your first steps, then drag between them to connect.' : 'Nothing has been mapped here yet.'}
            </p>
            {canEditHere && (
              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => addNode('start_event')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors">
                  <Plus size={15} /> Add Start
                </button>
                <button onClick={() => addNode('task')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-[#2563EB] border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors">
                  <Plus size={15} /> Add first step
                </button>
              </div>
            )}
          </div>
        ) : (
          <ProcessCanvas
            flow={flow}
            canEdit={canEditHere}
            selectedNodeId={selectedNodeId}
            visibleNodeIds={visible}
            diffStatus={comparing ? diff?.node_status ?? null : null}
            onSelectNode={setSelectedNodeId}
            onDrill={drill}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodesMove={onNodesMove}
            onDeleteNodes={deleteNodes}
            onAutoLayout={runAutoLayout}
            onUpdateConnection={updateConn}
            onDeleteConnection={deleteConn}
            topRightExtra={addStepControl}
            loadFlowAt={(mid, pid) => processHierarchyApi.getFlow(orgId, mid, pid)}
            onOpenMap={(mid) => router.push(`/dashboard/process-hierarchy/${mid}`)}
            onOpenDoc={openDoc}
            spawnCenterRef={spawnCenterRef}
            onCopyNodes={copyNodes}
            onPaste={pasteClipboard}
          />
        )}

        {docPreview && (
          <MaterialPreviewModal orgId={orgId} mapId={mapId} artifact={docPreview}
            onClose={() => setDocPreview(null)} onDownload={downloadDoc} />
        )}

        {/* Hint toast — dismissible, remembered per user. Sits top-left, clear of the
            floating Add step button (top-right) and the fit-to-view'd nodes. */}
        {!hintDismissed && (
          <div className="absolute top-3 left-3 z-20 max-w-[min(340px,calc(100%-24px))] animate-[popIn_.15s_ease-out]">
            <div className="flex items-start gap-2 rounded-[10px] bg-white/95 backdrop-blur border border-[#E2E8F0] shadow-sm pl-3 pr-1.5 py-2">
              <p className="text-[12px] leading-snug text-[#475569]">
                Click a step to edit it{canEditHere ? '; drag between step edges to connect, or click a connection to relabel it' : '; use “Open” on a container to go deeper'}.
              </p>
              <button onClick={dismissHint} aria-label="Dismiss hint"
                className="shrink-0 -mr-0.5 w-6 h-6 inline-flex items-center justify-center rounded-full text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Outline slide-over — floats over the canvas; click the canvas or pick an item to close. */}
        {showTree && (
          <>
            <div className="absolute inset-0 z-20" onClick={() => setShowTree(false)} aria-hidden="true" />
            <aside
              className="absolute z-30 top-3 left-3 bottom-3 right-3 sm:right-auto sm:w-[244px] flex flex-col bg-white/95 backdrop-blur border border-[#E2E8F0] rounded-[12px] shadow-[0_8px_28px_rgba(15,23,42,0.14)] overflow-hidden animate-[slideInLeft_.2s_ease-out]"
              onClick={(e) => e.stopPropagation()}
              aria-label="Outline"
            >
              <HierarchyTree
                tree={tree}
                mapName={map.name}
                currentParentId={parentId}
                selectedNodeId={selectedNodeId}
                onOpenLevel={(pid) => { setShowTree(false); openTreeLevel(pid) }}
                onSelectNode={(node) => { setShowTree(false); openTreeNode(node) }}
              />
            </aside>
          </>
        )}
      </div>

      {selectedNodeId && !comparing && (
        <NodeDrawer
          orgId={orgId} mapId={mapId} nodeId={selectedNodeId} tree={tree}
          onClose={() => setSelectedNodeId(null)}
          onChanged={() => refresh()}
          onDrill={(id) => { setSelectedNodeId(null); drill(id) }}
          onCopy={() => copyNodes([selectedNodeId])}
        />
      )}

      {comparing && diff && (
        <DiffPanel diff={diff} onClose={exitCompare} onJump={jumpTo} />
      )}

      {showDocs && (
        <ArtifactLibrary orgId={orgId} mapId={mapId} canEdit={map.can_edit} onClose={() => setShowDocs(false)} />
      )}

      {showSaveTpl && (
        <SaveTemplateModal orgId={orgId} mapId={mapId} mapName={map.name} onClose={() => setShowSaveTpl(false)} />
      )}

      {showRefPicker && (
        <ReferenceMapModal orgId={orgId} excludeId={mapId} onClose={() => setShowRefPicker(false)} onPick={addReference} />
      )}

      <ConfirmDialog
        open={showDeleteMap}
        danger
        title="Delete this entire map?"
        message={`This permanently deletes “${map.name}” and everything in it — all steps, connections, documents and saved versions. This cannot be undone.`}
        confirmLabel="Delete map"
        loading={deletingMap}
        onConfirm={deleteMap}
        onCancel={() => { if (!deletingMap) setShowDeleteMap(false) }}
      />
    </div>
  )
}

// ─── Reference-a-map picker ──────────────────────────────────────────────────
function ReferenceMapModal({ orgId, excludeId, onClose, onPick }: {
  orgId: string; excludeId: string; onClose: () => void; onPick: (m: { id: string; name: string }) => void
}) {
  const [maps, setMaps] = useState<ProcessMapSummary[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { processHierarchyApi.listMaps(orgId).then(setMaps).catch(() => setMaps([])) }, [orgId])
  const query = q.trim().toLowerCase()
  const filtered = (maps ?? []).filter((m) => m.id !== excludeId && m.name.toLowerCase().includes(query))
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-[fadeIn_.15s_ease-out]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
          <LinkIcon size={16} className="text-[#2563EB]" />
          <h3 className="text-base font-semibold text-[#0F172A]">Reference a map</h3>
          <button onClick={onClose} className="ml-auto text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search maps…"
              className="w-full pl-8 pr-3 py-2 text-[14px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {maps === null ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#2563EB]" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-[#64748B] text-center py-8">No other maps{q ? ' match' : ' yet'}.</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((m) => (
                <button key={m.id} onClick={() => onPick({ id: m.id, name: m.name })}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] hover:bg-[#F1F5F9] text-left transition-colors">
                  <Workflow size={15} className="shrink-0 text-[#2563EB]" />
                  <span className="truncate text-[14px] text-[#0F172A]">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="px-5 py-2.5 border-t border-[#E2E8F0] text-[11px] text-[#64748B]">
          Drops an instance that opens the chosen map. Edits to that map show wherever it’s referenced.
        </p>
      </div>
    </div>,
    document.body,
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left text-[13px] font-medium transition-colors ${danger ? 'text-[#DC2626] hover:bg-[#FEF2F2]' : 'text-[#0F172A] hover:bg-[#F1F5F9]'}`}>
      <span className={danger ? 'text-[#DC2626]' : 'text-[#475569]'}>{icon}</span> {label}
    </button>
  )
}

// ─── Save-as-template modal ──────────────────────────────────────────────────
function SaveTemplateModal({ orgId, mapId, mapName, onClose }: {
  orgId: string; mapId: string; mapName: string; onClose: () => void
}) {
  const { addToast } = useToast()
  const [name, setName] = useState(`${mapName} template`)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  async function save() {
    if (!name.trim() || busy) return
    setBusy(true)
    try { await processHierarchyApi.saveAsTemplate(orgId, mapId, { name: name.trim() }); setDone(true); setTimeout(onClose, 900) }
    catch { addToast('Could not save the template. Please try again.', 'error'); setBusy(false) }
  }
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-md p-6 animate-[fadeIn_.15s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0F172A]">Save as template</h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        {done ? (
          <p className="text-[#16A34A] text-sm inline-flex items-center gap-2 py-4"><Check size={16} /> Template saved.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-[#374151] mb-1">Template name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()}
              className="w-full px-3 py-2.5 text-[15px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none" />
            <p className="text-[12px] text-[#64748B] mt-1.5">Freezes this map’s current structure so you can spin up new maps from it later.</p>
            <div className="flex justify-end mt-5">
              <button onClick={save} disabled={!name.trim() || busy}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
                {busy && <Loader2 size={15} className="animate-spin" />} Save template
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── Diff panel ─────────────────────────────────────────────────────────────
const CHANGE_COLOR: Record<string, string> = { added: '#16A34A', removed: '#DC2626', changed: '#D97706' }
const FIELD_LABEL: Record<string, string> = {
  name: 'name', kind: 'type', status: 'status', description: 'description',
  responsible_user_id: 'responsible person', responsible_role_id: 'responsible role',
  parent_node_id: 'moved level', checklist: 'checklist', documents: 'documents',
  label: 'label', condition_kind: 'branch', source_node_id: 'source', target_node_id: 'target',
}

function DiffPanel({ diff, onClose, onJump }: {
  diff: MapDiff
  onClose: () => void
  onJump: (parentNodeId: string | null, nodeId: string | null, removed: boolean) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div className="absolute right-0 top-0 h-full w-full max-w-[400px] bg-white shadow-xl border-l border-[#E2E8F0] flex flex-col pointer-events-auto animate-[slideInRight_.22s_ease-out]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
          <GitCompare size={16} className="text-[#2563EB]" />
          <span className="text-sm font-semibold text-[#0F172A]">Changes</span>
          <span className="text-xs text-[#64748B]">{diff.summary.total_changes} total</span>
          <button onClick={onClose} className="ml-auto text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 text-[13px]">
          {diff.summary.total_changes === 0 && (
            <p className="text-[#475569] text-center py-8">No differences between these two versions.</p>
          )}

          {diff.nodes.length > 0 && (
            <Section title="Nodes">
              {diff.nodes.map((n) => (
                <button key={n.id} onClick={() => onJump(n.parent_node_id, n.id, n.change === 'removed')}
                  className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-[6px] hover:bg-[#F8FAFC]">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: CHANGE_COLOR[n.change] }} />
                  <span className="flex-1 min-w-0">
                    <span className="text-[#0F172A] font-medium">{n.name}</span>
                    <span className="text-[11px] text-[#64748B] ml-1.5 capitalize">{n.change}</span>
                    {n.fields.length > 0 && (
                      <span className="block text-[11px] text-[#64748B]">{n.fields.map((f) => FIELD_LABEL[f.field] ?? f.field).join(', ')}</span>
                    )}
                  </span>
                </button>
              ))}
            </Section>
          )}

          {diff.connections.length > 0 && (
            <Section title="Connections">
              {diff.connections.map((c) => (
                <button key={c.id} onClick={() => onJump(c.parent_node_id, null, false)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-[6px] hover:bg-[#F8FAFC]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHANGE_COLOR[c.change] }} />
                  <span className="text-[#475569] capitalize">{c.change} connection</span>
                  {c.fields.length > 0 && <span className="text-[11px] text-[#64748B]">({c.fields.map((f) => FIELD_LABEL[f.field] ?? f.field).join(', ')})</span>}
                </button>
              ))}
            </Section>
          )}

          {diff.artifacts.length > 0 && (
            <Section title="Documents">
              {diff.artifacts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHANGE_COLOR[a.change] }} />
                  <span className="text-[#0F172A]">{a.name}</span>
                  <span className="text-[11px] text-[#64748B] capitalize">{a.change}</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

// ─── Visibility filter panel ──────────────────────────────────────────────
function VisibilityPanel({ flow, visible, onChange, onClose }: {
  flow: FlowLevel; visible: Set<string> | null; onChange: (s: Set<string> | null) => void; onClose: () => void
}) {
  const allIds = useMemo(() => flow.nodes.map((n) => n.id), [flow.nodes])
  const isShown = (id: string) => !visible || visible.has(id)
  const toggle = (id: string) => {
    const base = new Set(visible ?? allIds)
    if (base.has(id)) base.delete(id); else base.add(id)
    onChange(base.size === allIds.length ? null : base)
  }
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg p-3 animate-[popIn_.12s_ease-out]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[#0F172A]">Show nodes</span>
          <button onClick={() => onChange(null)} className="text-[12px] font-medium text-[#2563EB] hover:underline">View all</button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {flow.nodes.map((n) => (
            <button key={n.id} onClick={() => toggle(n.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[6px] hover:bg-[#F8FAFC] text-left text-[13px]">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isShown(n.id) ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[#CBD5E1]'}`}>
                {isShown(n.id) && <Check size={12} className="text-white" />}
              </span>
              <span className="text-[#2563EB] shrink-0">{KIND_META[n.kind].icon}</span>
              <span className="truncate text-[#0F172A]">{n.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Versions panel ────────────────────────────────────────────────────────
function VersionsPanel({ orgId, mapId, canEdit, onClose, onRestored, onCompare }: {
  orgId: string; mapId: string; canEdit: boolean; onClose: () => void; onRestored: () => void
  onCompare: (base: string, target: string, baseLabel: string, targetLabel: string) => void
}) {
  const { addToast } = useToast()
  const [snaps, setSnaps] = useState<SnapshotSummary[] | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [baseRef, setBaseRef] = useState('')
  const [targetRef, setTargetRef] = useState('live')
  const [confirmRestore, setConfirmRestore] = useState<SnapshotSummary | null>(null)
  const [restoring, setRestoring] = useState(false)

  const reload = useCallback(() => { processHierarchyApi.listSnapshots(orgId, mapId).then(setSnaps).catch(() => setSnaps([])) }, [orgId, mapId])
  useEffect(() => { reload() }, [reload])

  const refOptions = useMemo(
    () => [{ value: 'live', label: 'Live (working)' }, ...(snaps ?? []).map((s) => ({ value: s.id, label: s.label }))],
    [snaps],
  )
  const labelOf = (v: string) => refOptions.find((o) => o.value === v)?.label ?? v
  const canCompare = baseRef && targetRef && baseRef !== targetRef

  async function create() {
    if (!label.trim() || busy) return
    setBusy(true)
    try { await processHierarchyApi.createSnapshot(orgId, mapId, { label: label.trim() }); setLabel(''); reload() }
    catch { addToast('Could not save this version.', 'error') }
    finally { setBusy(false) }
  }
  async function restore() {
    if (!confirmRestore) return
    setRestoring(true)
    try {
      await processHierarchyApi.restoreSnapshot(orgId, mapId, confirmRestore.id)
      setConfirmRestore(null); onClose(); onRestored()
    } catch { addToast('Could not restore that version.', 'error'); setRestoring(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg p-3 animate-[popIn_.12s_ease-out]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[#0F172A]">Saved versions</span>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={15} /></button>
        </div>

        {/* Compare */}
        <div className="mb-3 pb-3 border-b border-[#F1F5F9]">
          <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">Compare (as-is → to-be)</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <StyledSelect value={baseRef} onChange={setBaseRef} placeholder="From…"
                options={refOptions} size="sm" />
            </div>
            <span className="text-[#94A3B8] text-xs shrink-0">→</span>
            <div className="flex-1 min-w-0">
              <StyledSelect value={targetRef} onChange={setTargetRef} placeholder="To…"
                options={refOptions} size="sm" />
            </div>
          </div>
          <button disabled={!canCompare} onClick={() => onCompare(baseRef, targetRef, labelOf(baseRef), labelOf(targetRef))}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-[8px] bg-[#0F172A] text-white hover:bg-[#1E293B] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
            <GitCompare size={14} /> Compare
          </button>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 mb-3">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. As-Is 2026"
              onKeyDown={(e) => e.key === 'Enter' && create()}
              className="flex-1 px-2.5 py-1.5 text-[13px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none" />
            <button onClick={create} disabled={!label.trim() || busy} aria-label="Save version"
              className="shrink-0 w-8 h-8 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
            </button>
          </div>
        )}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {snaps === null ? <p className="text-[13px] text-[#64748B] py-2">Loading…</p>
            : snaps.length === 0 ? <p className="text-[13px] text-[#64748B] py-2">No versions saved yet.</p>
            : snaps.map((s) => (
              <div key={s.id} className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0F172A] truncate">{s.label}</p>
                  <p className="text-[11px] text-[#64748B]">{new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                {canEdit && (
                  <button onClick={() => setConfirmRestore(s)} title="Restore this version"
                    className="text-[#475569] hover:text-[#2563EB] shrink-0 inline-flex items-center gap-1 text-[12px] font-medium">
                    <RotateCcw size={13} /> Restore
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRestore}
        danger
        title="Restore this version?"
        message={confirmRestore ? `This replaces the current map with “${confirmRestore.label}”. Any unsaved changes to the live map will be lost.` : ''}
        confirmLabel="Restore version"
        loading={restoring}
        onConfirm={restore}
        onCancel={() => { if (!restoring) setConfirmRestore(null) }}
      />
    </>
  )
}
