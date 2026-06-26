import { PERSPECTIVE_META, type Goal, type GoalPerspective } from '@/lib/types/goals'

// ─── Layout constants (px) ──────────────────────────────────────────────────────

export const LANE_LABEL_W = 184
export const VPAD = 20 // breathing room top/bottom inside each lane

export const OBJ_H = 160
export const GOAL_H = 156
export const SUB_H = 104

export const OBJ_BAND_H = OBJ_H + VPAD * 2 // 200
export const LANE_H = GOAL_H + VPAD * 2 // 196
export const OBJ_W = 280
export const GOAL_W = 240
export const SUB_W = 200
export const GAP_X = 28
export const BLOCK_GAP = 72
export const RIGHT_PAD = 48

// BSC order, top → bottom.
export const LANE_ORDER: GoalPerspective[] = ['financial', 'customer', 'internal_process', 'learning_growth']

// Soft band tints (lighter than PERSPECTIVE_META.bg so full-width bands stay calm).
const BAND_TINT: Record<GoalPerspective, string> = {
  financial: '#F0FBF4',
  customer: '#EFF8FE',
  internal_process: '#F5F2FE',
  learning_growth: '#FEFCEB',
}

const laneTop = (p: GoalPerspective) => OBJ_BAND_H + LANE_ORDER.indexOf(p) * LANE_H
const OBJ_Y = VPAD
const goalY = (p: GoalPerspective) => laneTop(p) + VPAD
const subY = (p: GoalPerspective) => laneTop(p) + (LANE_H - SUB_H) / 2

// ─── Output shapes ───────────────────────────────────────────────────────────────

export interface LaneDef {
  key: string
  label: string
  sublabel?: string
  top: number
  height: number
  bg: string
  accent: string
  text: string
}
export interface CardDef {
  id: string
  kind: 'objective' | 'goal' | 'subgoal'
  goal: Goal
  x: number
  y: number
  w: number
  h: number
  goalCount?: number
  subCount?: number
  expanded?: boolean
  toggleable?: boolean
  crossPerspective?: boolean
}
export interface EdgeDef {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}
export interface StrategyLayout {
  lanes: LaneDef[]
  cards: CardDef[]
  edges: EdgeDef[]
  contentWidth: number
  totalHeight: number
  labelWidth: number
}

interface BuildOpts {
  showAll: boolean
  expandedGoals: Set<string>
}

// Compute absolute geometry for the strategy map: an Objectives apex band over four
// perspective swim-lanes. Goals sit in their perspective lane under the objective
// they roll up to; sub-goals sit in THEIR OWN perspective lane, linked to the parent
// goal by an edge (which may cross lanes).
export function buildStrategyLayout(goals: Goal[], opts: BuildOpts): StrategyLayout {
  const { showAll, expandedGoals } = opts

  const objectives = goals.filter((g) => g.level === 'objective')
  const annualByObjective = new Map<string, Goal[]>()
  const subsByGoal = new Map<string, Goal[]>()
  for (const g of goals) {
    if (g.level === 'annual' && g.parent_goal_id) {
      const a = annualByObjective.get(g.parent_goal_id) ?? []
      a.push(g)
      annualByObjective.set(g.parent_goal_id, a)
    } else if (g.level === 'quarterly' && g.parent_goal_id) {
      const a = subsByGoal.get(g.parent_goal_id) ?? []
      a.push(g)
      subsByGoal.set(g.parent_goal_id, a)
    }
  }
  const objectiveIds = new Set(objectives.map((o) => o.id))
  const orphanGoals = goals.filter(
    (g) => g.level === 'annual' && (!g.parent_goal_id || !objectiveIds.has(g.parent_goal_id)),
  )

  const cards: CardDef[] = []
  const edges: EdgeDef[] = []
  const byDue = (a: Goal, b: Goal) => a.due_date.localeCompare(b.due_date)
  const isVisible = (id: string) => showAll || expandedGoals.has(id)

  let xCursor = LANE_LABEL_W + 24

  // Place an objective's goals (and visible sub-goals) into perspective lanes,
  // packed left→right. Returns the block's x range.
  function layoutBlock(blockGoals: Goal[]): { start: number; end: number } {
    const start = xCursor
    const laneCursor: Record<GoalPerspective, number> = {
      financial: start,
      customer: start,
      internal_process: start,
      learning_growth: start,
    }
    for (const g of [...blockGoals].sort(byDue)) {
      const gp = g.perspective ?? 'internal_process'
      const gx = laneCursor[gp]
      const gy = goalY(gp)
      const subCount = g._count?.children ?? subsByGoal.get(g.id)?.length ?? 0
      const expanded = isVisible(g.id)
      cards.push({ id: g.id, kind: 'goal', goal: g, x: gx, y: gy, w: GOAL_W, h: GOAL_H, subCount, expanded, toggleable: !showAll })
      laneCursor[gp] = gx + GOAL_W + GAP_X

      if (expanded) {
        for (const s of [...(subsByGoal.get(g.id) ?? [])].sort(byDue)) {
          const sp = s.perspective ?? gp
          const sx = laneCursor[sp]
          const sy = subY(sp)
          cards.push({ id: s.id, kind: 'subgoal', goal: s, x: sx, y: sy, w: SUB_W, h: SUB_H, crossPerspective: sp !== gp })
          laneCursor[sp] = sx + SUB_W + GAP_X
          edges.push({ id: `e-${g.id}-${s.id}`, x1: gx + GOAL_W / 2, y1: gy + GOAL_H, x2: sx + SUB_W / 2, y2: sy, color: PERSPECTIVE_META[sp].accent })
        }
      }
    }
    const end = Math.max(start + GOAL_W, ...Object.values(laneCursor))
    return { start, end }
  }

  for (const o of objectives) {
    const blockGoals = annualByObjective.get(o.id) ?? []
    const { start, end } = layoutBlock(blockGoals)
    const ox = Math.max(start, (start + (end - GAP_X)) / 2 - OBJ_W / 2)
    cards.push({ id: o.id, kind: 'objective', goal: o, x: ox, y: OBJ_Y, w: OBJ_W, h: OBJ_H, goalCount: blockGoals.length })
    for (const g of blockGoals) {
      const gc = cards.find((c) => c.id === g.id)
      if (gc) {
        edges.push({
          id: `e-${o.id}-${g.id}`,
          x1: ox + OBJ_W / 2,
          y1: OBJ_Y + OBJ_H,
          x2: gc.x + GOAL_W / 2,
          y2: gc.y,
          color: PERSPECTIVE_META[g.perspective ?? 'internal_process'].accent,
        })
      }
    }
    xCursor = end + BLOCK_GAP
  }

  if (orphanGoals.length) {
    layoutBlock(orphanGoals)
    xCursor += BLOCK_GAP
  }

  const contentEnd = Math.max(xCursor - BLOCK_GAP, LANE_LABEL_W + GOAL_W)
  const contentWidth = contentEnd + RIGHT_PAD
  const totalHeight = OBJ_BAND_H + LANE_ORDER.length * LANE_H

  const lanes: LaneDef[] = [
    { key: 'objectives', label: 'Objectives', sublabel: 'Strategic north stars', top: 0, height: OBJ_BAND_H, bg: '#F8FAFC', accent: '#334155', text: '#334155' },
    ...LANE_ORDER.map((p) => {
      const m = PERSPECTIVE_META[p]
      return { key: p, label: m.label, top: laneTop(p), height: LANE_H, bg: BAND_TINT[p], accent: m.accent, text: m.text }
    }),
  ]

  return { lanes, cards, edges, contentWidth, totalHeight, labelWidth: LANE_LABEL_W }
}
