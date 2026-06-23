import { ancestorChain, descendantIds, holidayReaches, type DeptNode, type CascadeReach } from './dept-tree.util'

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
