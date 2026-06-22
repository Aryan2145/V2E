import type { Department } from './types'

/**
 * Department node colors for the org chart.
 *
 * Scheme: each TOP-LEVEL branch (a child of the root/Executive) gets a distinct
 * hue from the palette; descendants inherit that hue, lightened a step at each
 * level down ("full tinted card, faded by depth"). A department may carry an
 * explicit `color` override, which becomes the base hue for it AND cascades to
 * its descendants. The root itself is a neutral slate.
 *
 * Palette reuses hues already used across the app (avatars, modules, scorecard)
 * so the chart feels native.
 */
export const BRANCH_PALETTE = [
  '#2563EB', // blue
  '#7C3AED', // violet
  '#16A34A', // green
  '#D97706', // amber
  '#0891B2', // cyan
  '#DC2626', // red
  '#BE185D', // pink
  '#059669', // teal
  '#CA8A04', // gold
  '#0369A1', // deep blue
]
export const ROOT_COLOR = '#334155' // slate-700

export interface NodeColor {
  fill: string
  text: string
  border: string
  base: string // the un-faded branch/override hue (used for swatches, edges)
}

// ─── hex helpers ────────────────────────────────────────────────────────────
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function rgbToHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}
function mix(hex: string, target: string, amt: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  return rgbToHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amt))
}
const lighten = (h: string, a: number) => mix(h, '#FFFFFF', a)
const darken = (h: string, a: number) => mix(h, '#000000', a)
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const FADE_STEP = 0.26 // lightening applied per level below the hue's origin
const FADE_MAX = 0.68

/** Per-department node colors, keyed by department id. */
export function computeNodeColors(departments: Department[]): Record<string, NodeColor> {
  const byId = new Map(departments.map((d) => [d.id, d]))
  const childrenOf = new Map<string, string[]>()
  const roots: string[] = []
  for (const d of departments) {
    const p = d.parent_department_id
    if (p && byId.has(p)) {
      const arr = childrenOf.get(p)
      if (arr) arr.push(d.id)
      else childrenOf.set(p, [d.id])
    } else {
      roots.push(d.id)
    }
  }

  // Top-level branches = children of roots; assign palette hues by name (stable).
  const branchIds = roots.flatMap((r) => childrenOf.get(r) ?? [])
  const branchIdx = new Map<string, number>()
  ;[...branchIds]
    .sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name))
    .forEach((id, i) => branchIdx.set(id, i % BRANCH_PALETTE.length))

  const out: Record<string, NodeColor> = {}
  const visit = (id: string, depth: number, parentBase: { hex: string; depth: number } | null) => {
    const d = byId.get(id)!
    let base: { hex: string; depth: number }
    if (d.color) base = { hex: d.color, depth }
    else if (depth === 0) base = { hex: ROOT_COLOR, depth: 0 }
    else if (branchIdx.has(id)) base = { hex: BRANCH_PALETTE[branchIdx.get(id)!], depth }
    else if (parentBase) base = parentBase
    else base = { hex: BRANCH_PALETTE[0], depth }

    const rel = Math.min(FADE_MAX, Math.max(0, (depth - base.depth) * FADE_STEP))
    const fill = depth === 0 && !d.color ? ROOT_COLOR : lighten(base.hex, rel)
    const text = luminance(fill) < 0.62 ? '#FFFFFF' : '#0F172A'
    out[id] = { fill, text, border: darken(fill, 0.1), base: base.hex }

    for (const c of childrenOf.get(id) ?? []) visit(c, depth + 1, base)
  }
  for (const r of roots) visit(r, 0, null)

  // Fallback for anything not reached.
  for (const d of departments) {
    if (!out[d.id]) {
      const fill = lighten(d.color ?? BRANCH_PALETTE[0], 0.4)
      out[d.id] = { fill, text: '#0F172A', border: darken(fill, 0.1), base: d.color ?? BRANCH_PALETTE[0] }
    }
  }
  return out
}
