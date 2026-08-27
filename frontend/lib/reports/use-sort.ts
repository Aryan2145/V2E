import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'
export type SortAccessor<T> = (row: T) => string | number | null | undefined

/**
 * Lightweight client-side column sort shared by the ageing grids + the drill list.
 * Nulls always sink to the bottom regardless of direction, so "no due date" / "not
 * yet due" rows never crowd the top of a "most late" sort.
 */
export function useSort<T>(
  rows: T[],
  accessors: Record<string, SortAccessor<T>>,
  initial: { key: string; dir: SortDir },
) {
  const [key, setKey] = useState(initial.key)
  const [dir, setDir] = useState<SortDir>(initial.dir)

  const sorted = useMemo(() => {
    const acc = accessors[key]
    if (!acc) return rows
    const arr = [...rows]
    arr.sort((a, b) => {
      const va = acc(a)
      const vb = acc(b)
      const na = va === null || va === undefined
      const nb = vb === null || vb === undefined
      if (na && nb) return 0
      if (na) return 1
      if (nb) return -1
      const c =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb))
      return dir === 'asc' ? c : -c
    })
    return arr
    // accessors is a stable literal defined at call site; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir])

  const toggle = (k: string) => {
    if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setKey(k)
      setDir('desc')
    }
  }

  return { sorted, sortKey: key, dir, toggle, setSort: (k: string, d: SortDir) => { setKey(k); setDir(d) } }
}
