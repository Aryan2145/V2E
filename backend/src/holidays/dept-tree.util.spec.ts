import {
  ancestorChain,
  descendantIds,
  holidayReaches,
  orgHolidaySuppressed,
  type DeptNode,
  type CascadeReach,
  type OrgOptOutAnchor,
} from './dept-tree.util'

/**
 * Sample department tree (mirrors the brief's example shape):
 *
 *   Sales
 *   ├─ West Zone
 *   │  ├─ Gujarat
 *   │  │  └─ Vadodara
 *   │  └─ Maharashtra
 *   └─ North Zone
 *      └─ Rajasthan
 *         └─ Jodhpur
 */
const DEPTS: DeptNode[] = [
  { id: 'sales', parent_department_id: null },
  { id: 'west', parent_department_id: 'sales' },
  { id: 'guj', parent_department_id: 'west' },
  { id: 'vad', parent_department_id: 'guj' },
  { id: 'mah', parent_department_id: 'west' },
  { id: 'north', parent_department_id: 'sales' },
  { id: 'raj', parent_department_id: 'north' },
  { id: 'jod', parent_department_id: 'raj' },
]

const chainOf = (id: string) => ancestorChain(DEPTS, id)

describe('descendantIds (cascade reach for "All")', () => {
  it('returns every descendant at any depth', () => {
    expect(descendantIds(DEPTS, 'sales')).toEqual(
      new Set(['west', 'guj', 'vad', 'mah', 'north', 'raj', 'jod']),
    )
  })
  it('returns the subtree for an inner node', () => {
    expect(descendantIds(DEPTS, 'west')).toEqual(new Set(['guj', 'vad', 'mah']))
  })
  it('is empty for a leaf', () => {
    expect(descendantIds(DEPTS, 'vad').size).toBe(0)
  })
})

describe('ancestorChain', () => {
  it('builds root → … → self', () => {
    expect(chainOf('vad')).toEqual(['sales', 'west', 'guj', 'vad'])
  })
})

describe('holidayReaches — "All" cascade from Sales reaches every level', () => {
  // "All" means every descendant is a target.
  const all: CascadeReach = {
    originId: 'sales',
    targetIds: Array.from(descendantIds(DEPTS, 'sales')),
    optOutIds: [],
  }
  it.each(['west', 'guj', 'vad', 'mah', 'north', 'raj', 'jod'])('reaches %s', (id) => {
    expect(holidayReaches(chainOf(id), id, all)).toBe(true)
  })
})

describe('holidayReaches — opt-out flows DOWN only', () => {
  // Sales holiday cascaded to all; West Zone opts out.
  const reach: CascadeReach = {
    originId: 'sales',
    targetIds: Array.from(descendantIds(DEPTS, 'sales')),
    optOutIds: ['west'],
  }

  it('detaches the opted-out department itself (West Zone)', () => {
    expect(holidayReaches(chainOf('west'), 'west', reach)).toBe(false)
  })

  it('detaches its descendants (Gujarat, Vadodara, Maharashtra)', () => {
    expect(holidayReaches(chainOf('guj'), 'guj', reach)).toBe(false)
    expect(holidayReaches(chainOf('vad'), 'vad', reach)).toBe(false)
    expect(holidayReaches(chainOf('mah'), 'mah', reach)).toBe(false)
  })

  it('leaves the parent untouched (Sales keeps it — it is the origin/owner)', () => {
    // Sales owns the holiday, so it is never a "reach" decision, but its other
    // branch must be unaffected:
    expect(holidayReaches(chainOf('north'), 'north', reach)).toBe(true)
  })

  it('leaves sibling branches untouched (North Zone → Rajasthan → Jodhpur)', () => {
    expect(holidayReaches(chainOf('raj'), 'raj', reach)).toBe(true)
    expect(holidayReaches(chainOf('jod'), 'jod', reach)).toBe(true)
  })
})

describe('holidayReaches — a non-target department never inherits', () => {
  it('returns false when the department is not in the target set ("Some")', () => {
    const some: CascadeReach = { originId: 'sales', targetIds: ['north', 'raj', 'jod'], optOutIds: [] }
    expect(holidayReaches(chainOf('west'), 'west', some)).toBe(false) // not chosen
    expect(holidayReaches(chainOf('raj'), 'raj', some)).toBe(true) // chosen subtree
  })
})

describe('orgHolidaySuppressed — org holiday removed at a department', () => {
  it('is not suppressed anywhere when there are no opt-outs', () => {
    for (const id of ['sales', 'west', 'guj', 'vad', 'mah', 'north', 'raj', 'jod']) {
      expect(orgHolidaySuppressed(chainOf(id), id, [])).toBe(false)
    }
  })

  it('"just this department" (applies_to_subtree=false) suppresses only the anchor', () => {
    const anchors: OrgOptOutAnchor[] = [{ departmentId: 'west', appliesToSubtree: false }]
    expect(orgHolidaySuppressed(chainOf('west'), 'west', anchors)).toBe(true) // the anchor itself
    expect(orgHolidaySuppressed(chainOf('guj'), 'guj', anchors)).toBe(false) // child keeps it
    expect(orgHolidaySuppressed(chainOf('vad'), 'vad', anchors)).toBe(false) // grandchild keeps it
    expect(orgHolidaySuppressed(chainOf('sales'), 'sales', anchors)).toBe(false) // parent keeps it
    expect(orgHolidaySuppressed(chainOf('north'), 'north', anchors)).toBe(false) // sibling branch keeps it
  })

  it('"this department + sub-departments" (applies_to_subtree=true) cascades DOWN only', () => {
    const anchors: OrgOptOutAnchor[] = [{ departmentId: 'west', appliesToSubtree: true }]
    expect(orgHolidaySuppressed(chainOf('west'), 'west', anchors)).toBe(true) // anchor
    expect(orgHolidaySuppressed(chainOf('guj'), 'guj', anchors)).toBe(true) // descendant
    expect(orgHolidaySuppressed(chainOf('vad'), 'vad', anchors)).toBe(true) // deep descendant
    expect(orgHolidaySuppressed(chainOf('mah'), 'mah', anchors)).toBe(true) // descendant
    expect(orgHolidaySuppressed(chainOf('sales'), 'sales', anchors)).toBe(false) // parent unaffected
    expect(orgHolidaySuppressed(chainOf('north'), 'north', anchors)).toBe(false) // sibling unaffected
    expect(orgHolidaySuppressed(chainOf('jod'), 'jod', anchors)).toBe(false) // other branch unaffected
  })

  it('a child opt-out does not bubble up to its parent', () => {
    const anchors: OrgOptOutAnchor[] = [{ departmentId: 'vad', appliesToSubtree: true }]
    expect(orgHolidaySuppressed(chainOf('guj'), 'guj', anchors)).toBe(false) // parent keeps it
    expect(orgHolidaySuppressed(chainOf('vad'), 'vad', anchors)).toBe(true) // anchor removes it
  })
})
