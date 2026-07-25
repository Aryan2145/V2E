import type { Department } from './types'

/**
 * Department node colors for the org chart.
 *
 * Scheme: EVERY department gets its OWN distinct solid colour by default — no
 * fading, no branch inheritance. Colours are auto-assigned from evenly-spaced
 * hues around the wheel (golden-angle), so no two departments share a colour
 * until the whole wheel is used, and each newly-added department takes the next
 * unused hue. A department may still carry an explicit `color` override (set
 * in-app), which simply wins for that one node.
 *
 * BRANCH_PALETTE is the curated set offered in the in-app colour picker; the
 * auto-assignment uses generated hues so it scales to any number of departments.
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

export interface NodeColor {
  fill: string
  text: string
  border: string
  base: string // the solid hue (used for swatches, edges, employee dots)
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
const darken = (h: string, a: number) => mix(h, '#000000', a)
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255])
}

// Golden-angle hue stepping spreads successive indices as far apart on the
// colour wheel as possible, so consecutive departments look maximally distinct
// and colours don't visibly repeat until the wheel is exhausted. Fixed
// saturation/lightness keeps every node equally vivid and readable.
const GOLDEN_ANGLE = 137.508
function distinctColor(i: number): string {
  return hslToHex((i * GOLDEN_ANGLE) % 360, 66, 47)
}

/** Per-department node colors, keyed by department id. */
export function computeNodeColors(departments: Department[]): Record<string, NodeColor> {
  // Stable assignment order — oldest first, then name — so a department keeps
  // its colour as others are added, and each NEW department takes the next hue.
  const ordered = [...departments].sort(
    (a, b) =>
      (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.name.localeCompare(b.name),
  )

  const out: Record<string, NodeColor> = {}
  ordered.forEach((d, i) => {
    // Explicit in-app override wins; otherwise auto-assign a distinct hue.
    const base = d.color ?? distinctColor(i)
    const text = luminance(base) < 0.6 ? '#FFFFFF' : '#0F172A'
    out[d.id] = { fill: base, text, border: darken(base, 0.12), base }
  })
  return out
}
