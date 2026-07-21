'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
} from '@/lib/api/process-hierarchy'
import dynamic from 'next/dynamic'
import NodeDrawer from '@/components/process-hierarchy/NodeDrawer'
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
  ChevronLeft, Eye, Pencil, Filter, History, Plus, Check, X, Loader2, RotateCcw,
  GitCompare, FolderOpen, Save, MoreHorizontal, PanelLeft,
} from 'lucide-react'

const ADD_KINDS: ProcessNodeKind[] = ['task', 'decision', 'subprocess', 'container', 'start_event', 'end_event']

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
  const [showMore, setShowMore] = useState(false)
  const [showTree, setShowTree] = useState(true)
  const [modeInitialized, setModeInitialized] = useState(false)
  const [diff, setDiff] = useState<MapDiff | null>(null)
  const [comparing, setComparing] = useState<{ base: string; target: string; baseLabel: string; targetLabel: string } | null>(null)

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

  const addNode = useCallback(async (kind: ProcessNodeKind) => {
    if (!flow) return
    setShowAdd(false)
    const n = flow.nodes.length
    try {
      await processHierarchyApi.createNode(orgId, mapId, {
        parent_node_id: parentId,
        kind,
        name: `New ${KIND_META[kind].label}`,
        position_x: 80 + (n % 4) * 240,
        position_y: 80 + Math.floor(n / 4) * 140,
      })
      await refresh()
    } catch { addToast('Could not add that step. Please try again.', 'error') }
  }, [flow, orgId, mapId, parentId, refresh, addToast])

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
    await processHierarchyApi.bulkPosition(orgId, mapId, [{ id: nodeId, position_x: x, position_y: y }])
      .catch(() => addToast('Could not save the new position.', 'error'))
  }, [orgId, mapId, addToast])

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

  return (
    <div>
      {/* Sticky chrome — back, breadcrumb, and the working toolbar stay pinned. */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-[#F8FAFC]/95 backdrop-blur border-b border-[#E2E8F0] pt-1 pb-3">
        <button onClick={() => router.push('/dashboard/process-hierarchy')}
          className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors mb-2">
          <ChevronLeft size={15} /> All maps
        </button>

        {/* Breadcrumb — single line, scrolls horizontally rather than wrapping. */}
        <div className="flex items-center gap-1.5 text-[13px] text-[#64748B] overflow-x-auto whitespace-nowrap pb-0.5 mb-2 [scrollbar-width:none]">
          <button onClick={() => goTo(null)} className={`font-medium hover:text-[#2563EB] max-w-[200px] truncate ${parentId === null ? 'text-[#0F172A]' : ''}`}>{map.name}</button>
          {flow.breadcrumb.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1.5 shrink-0">
              <span>›</span>
              {i < flow.breadcrumb.length - 1
                ? <button onClick={() => goTo(c.id)} className="font-medium hover:text-[#2563EB] max-w-[160px] truncate">{c.name}</button>
                : <span className="font-semibold text-[#0F172A] max-w-[220px] truncate">{c.name}</span>}
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowTree((v) => !v)} title={showTree ? 'Hide outline' : 'Show outline'}
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-[8px] border ${showTree ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F1F5F9]'}`}>
            <PanelLeft size={14} /> Outline
          </button>

          {map.can_edit && (
            <div className="inline-flex rounded-[8px] border border-[#E2E8F0] overflow-hidden">
              <button onClick={() => setMode('view')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium ${mode === 'view' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F1F5F9]'}`}>
                <Eye size={14} /> View
              </button>
              <button onClick={() => setMode('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium ${mode === 'edit' ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F1F5F9]'}`}>
                <Pencil size={14} /> Edit
              </button>
            </div>
          )}

          {/* Visibility filter */}
          <div className="relative">
            <button onClick={() => setShowFilter((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[8px] border ${visible ? 'border-[#2563EB] text-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F1F5F9]'}`}>
              <Filter size={14} /> {visible ? `Showing ${visible.size}` : 'View all'}
            </button>
            {showFilter && (
              <VisibilityPanel flow={flow} visible={visible} onChange={setVisible} onClose={() => setShowFilter(false)} />
            )}
          </div>

          {/* Right-aligned primary + overflow */}
          <div className="flex items-center gap-2 ml-auto">
            {/* More (secondary tools) */}
            <div className="relative">
              <button onClick={() => setShowMore((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[8px] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#F1F5F9]">
                <MoreHorizontal size={14} /> More
              </button>
              {showMore && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg p-1.5 animate-[popIn_.12s_ease-out]">
                    <MenuItem icon={<History size={15} />} label="Versions & compare" onClick={() => { setShowMore(false); setShowVersions(true) }} />
                    {map.can_edit && <MenuItem icon={<FolderOpen size={15} />} label="Document library" onClick={() => { setShowMore(false); setShowDocs(true) }} />}
                    <MenuItem icon={<Save size={15} />} label="Save as template" onClick={() => { setShowMore(false); setShowSaveTpl(true) }} />
                  </div>
                </>
              )}
            </div>

            {/* Primary: Add (solid blue, opens a styled kind menu) */}
            {canEditHere && (
              <div className="relative">
                <button onClick={() => setShowAdd((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-[8px] bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors">
                  <Plus size={15} /> Add step
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
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Versions popover anchor (opened from More) */}
            {showVersions && (
              <div className="relative">
                <VersionsPanel orgId={orgId} mapId={mapId} canEdit={map.can_edit}
                  onClose={() => setShowVersions(false)} onRestored={() => refresh()} onCompare={runCompare} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compare banner */}
      {comparing && diff && (
        <div className="flex items-center gap-3 flex-wrap rounded-[10px] bg-[#0F172A] text-white px-4 py-2.5 mt-4">
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

      {/* Body — outline tree + canvas */}
      <div className="flex gap-4 pt-4">
        {showTree && (
          <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden" style={{ height: '68vh', minHeight: 460 }}>
            <HierarchyTree
              tree={tree}
              mapName={map.name}
              currentParentId={parentId}
              selectedNodeId={selectedNodeId}
              onOpenLevel={openTreeLevel}
              onSelectNode={openTreeNode}
            />
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden" style={{ height: '68vh', minHeight: 460 }}>
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
                onAutoLayout={runAutoLayout}
                onUpdateConnection={updateConn}
                onDeleteConnection={deleteConn}
              />
            )}
          </div>
          <p className="text-[12px] text-[#64748B] mt-2">
            Click a step to edit it{canEditHere ? '; use “Open” on a container to go deeper, drag between step edges to connect, or click a connection to relabel it' : '; use “Open” on a container to go deeper'}.
          </p>
        </div>
      </div>

      {selectedNodeId && !comparing && (
        <NodeDrawer
          orgId={orgId} mapId={mapId} nodeId={selectedNodeId} tree={tree}
          onClose={() => setSelectedNodeId(null)}
          onChanged={() => refresh()}
          onDrill={(id) => { setSelectedNodeId(null); drill(id) }}
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
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] hover:bg-[#F1F5F9] text-left text-[13px] font-medium text-[#0F172A] transition-colors">
      <span className="text-[#475569]">{icon}</span> {label}
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
      <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg p-3 animate-[popIn_.12s_ease-out]">
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
