import type { Department } from './types'

/**
 * Department node colors for the org chart.
 *
 * Scheme: FAMILY INHERITANCE. Each top-level branch (a root department) is given
 * one royal base hue. Every descendant keeps that SAME hue and only steps
 * lighter and a touch softer per level DOWN the tree, so a whole branch reads as
 * one colour family — the entire Sales branch is the blue family, the entire Ops
 * branch the emerald family.
 *
 * Colour changes ONLY with depth, never across siblings: two departments with
 * the same parent (e.g. ai and aii under a) get the EXACT same colour. A colour
 * only shifts lighter when you go one level down (ai -> ai's own child).
 *
 * Four rules shape the palette:
 *  1. Roots use bright, vivid ROYAL_BRANCHES — hues well spread so adjacent
 *     branches stay distinct. No olive / mustard tones.
 *  2. Each hue carries its OWN base lightness, tuned so a single dark text colour
 *     clears WCAG AA (~4.9:1) on the root — perceptually-dark hues (blue, violet,
 *     indigo) start lighter, naturally-bright ones (green, gold, teal) stay vivid.
 *  3. The fade is CAPPED (L_CAP lightness ceiling + S_FLOOR saturation floor) so
 *     a deep descendant stays clearly coloured and never washes out toward white.
 *  4. An explicit in-app `color` override wins for that node, and the branch
 *     below it re-tints (hue, lightness and saturation) from the override.
 *
 * BRANCH_PALETTE is the curated set offered in the in-app colour picker — the
 * exact root colours produced by the branches below, so the picker is WYSIWYG.
 */
export const BRANCH_PALETTE = [
  '#5E89ED', // royal blue
  '#EBB447', // gold
  '#A871EF', // violet
  '#47EBAF', // emerald
  '#EC519E', // rose
  '#47CFEB', // teal
  '#EB47EB', // fuchsia
  '#EB7E47', // coral
  '#7A84F0', // indigo
  '#47EBCA', // jade
]

export interface NodeColor {
  fill: string
  text: string
  border: string
  base: string // the solid hue (used for swatches, edges, employee dots)
}

// ─── hex / colour-space helpers ───────────────────────────────────────────────
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
const darken = (h: string, a: number) => mix(h, '#000000', a)
// WCAG relative luminance (gamma-correct) — used to pick a readable text colour.
function relLuminance(hex: string): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255])
}

/** Hue/sat/lightness (h 0–360, s/l 0–100) of a hex — to re-tint under an override. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = ((h * 60) % 360 + 360) % 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s: s * 100, l: l * 100 }
}

// ─── branch palette ───────────────────────────────────────────────────────────
// Royal base hues for top-level branches, each with a tuned base lightness (see
// rule 2 above). Ordered so adjacent roots land far apart on the wheel.
const ROYAL_BRANCHES: { h: number; l: number }[] = [
  { h: 222, l: 65 }, // royal blue
  { h: 40, l: 60 }, // gold
  { h: 266, l: 69 }, // violet
  { h: 158, l: 60 }, // emerald
  { h: 330, l: 62 }, // rose
  { h: 190, l: 60 }, // teal
  { h: 300, l: 60 }, // fuchsia
  { h: 20, l: 60 }, // coral
  { h: 235, l: 71 }, // indigo
  { h: 168, l: 60 }, // jade
]

const ROOT_S = 80 // root saturation — vivid but not neon
const L_STEP = 8 // lighter per level down
const S_STEP = 7 // softer per level down
const L_CAP = 82 // never lighter than this — halts the fade well before white
const S_FLOOR = 48 // never flatter than this — always visibly coloured

/** Per-department node colors, keyed by department id. */
export function computeNodeColors(departments: Department[]): Record<string, NodeColor> {
  const ids = new Set(departments.map((d) => d.id))

  // Stable order → deterministic colours; a dept keeps its shade as siblings are
  // added: oldest first, then name.
  const cmp = (a: Department, b: Department) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.name.localeCompare(b.name)

  // Bucket children under their parent (roots = no parent, or a parent outside
  // this set), each bucket stably ordered.
  const childrenOf = new Map<string | null, Department[]>()
  for (const d of departments) {
    const pid =
      d.parent_department_id && ids.has(d.parent_department_id) ? d.parent_department_id : null
    const arr = childrenOf.get(pid) ?? []
    arr.push(d)
    childrenOf.set(pid, arr)
  }
  childrenOf.forEach((arr) => arr.sort(cmp))

  const out: Record<string, NodeColor> = {}
  const seen = new Set<string>() // guard against parent/child cycles

  // `levelL`/`levelS` is the colour for THIS whole level: every sibling under the
  // same parent shares it exactly — colour only changes going down a level, never
  // across siblings. Each child row steps one L_STEP lighter / S_STEP softer.
  const assign = (dept: Department, hue: number, levelL: number, levelS: number) => {
    if (seen.has(dept.id)) return
    seen.add(dept.id)

    const ov = dept.color ? hexToHsl(dept.color) : null
    const nodeHue = ov ? ov.h : hue
    const nodeL = ov ? ov.l : Math.min(levelL, L_CAP)
    const nodeS = ov ? ov.s : levelS
    const base = dept.color ?? hslToHex(nodeHue, nodeS, nodeL)

    // Dark text across the whole canvas — every auto-assigned colour is a bright
    // tint, so it always wins. Only a genuinely dark manual override (e.g. a
    // legacy pick) flips to white, so text is never unreadable. (Crossover of
    // #0F172A vs #FFFFFF contrast sits at rel-luminance ~0.207.)
    const text = relLuminance(base) > 0.2 ? '#0F172A' : '#FFFFFF'
    out[dept.id] = { fill: base, text, border: darken(base, 0.14), base }

    const childL = Math.min(nodeL + L_STEP, L_CAP)
    const childS = Math.max(nodeS - S_STEP, S_FLOOR)
    const kids = childrenOf.get(dept.id) ?? []
    kids.forEach((k) => assign(k, nodeHue, childL, childS))
  }

  const roots = childrenOf.get(null) ?? []
  roots.forEach((r, i) => {
    const b = ROYAL_BRANCHES[i % ROYAL_BRANCHES.length]
    assign(r, b.h, b.l, ROOT_S)
  })

  return out
}
