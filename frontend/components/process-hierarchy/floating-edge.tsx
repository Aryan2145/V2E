'use client'

import { useStore, getBezierPath, BaseEdge, EdgeLabelRenderer, Position, type EdgeProps, type Node } from 'reactflow'

// ─── Floating-edge geometry ──────────────────────────────────────────────────
// Computes where the line between two node centres crosses each node's boundary,
// so a connection always leaves/enters the *nearest* side — no fixed left→right
// handles, no "S" shape when a node sits below another.

interface Box { x: number; y: number; width: number; height: number }

function boxOf(node: Node): Box {
  const pos = node.positionAbsolute ?? node.position
  return { x: pos.x, y: pos.y, width: node.width ?? 0, height: node.height ?? 0 }
}

// Intersection of the centre-to-centre line with `node`'s rectangle.
function intersection(node: Box, other: Box) {
  const w = node.width / 2
  const h = node.height / 2
  const x2 = node.x + w
  const y2 = node.y + h
  const x1 = other.x + other.width / 2
  const y1 = other.y + other.height / 2
  if (!w || !h) return { x: x2, y: y2 }
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h)
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 }
}

function sideOf(node: Box, point: { x: number; y: number }): Position {
  const px = Math.round(point.x)
  const py = Math.round(point.y)
  if (px <= Math.round(node.x) + 1) return Position.Left
  if (px >= Math.round(node.x + node.width) - 1) return Position.Right
  if (py <= Math.round(node.y) + 1) return Position.Top
  return Position.Bottom
}

function edgeParams(source: Box, target: Box) {
  const sp = intersection(source, target)
  const tp = intersection(target, source)
  return { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y, sourcePos: sideOf(source, sp), targetPos: sideOf(target, tp) }
}

// ─── Edge component ──────────────────────────────────────────────────────────
export default function FloatingEdge({ id, source, target, markerEnd, style, data }: EdgeProps<{ label?: string }>) {
  const sourceNode = useStore((s) => s.nodeInternals.get(source))
  const targetNode = useStore((s) => s.nodeInternals.get(target))
  if (!sourceNode || !targetNode) return null

  const { sx, sy, tx, ty, sourcePos, targetPos } = edgeParams(boxOf(sourceNode), boxOf(targetNode))
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx, sourceY: sy, sourcePosition: sourcePos,
    targetX: tx, targetY: ty, targetPosition: targetPos,
  })

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute rounded-[4px] bg-white/90 px-1 py-0.5 text-[11px] font-semibold text-[#475569]"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
