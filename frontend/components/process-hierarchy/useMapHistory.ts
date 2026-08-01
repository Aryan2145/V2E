'use client'

// Session undo/redo for the process-map editor. Everything the user does is saved to the server
// immediately, so undo can't just rewind React state — it replays a whole serialized map STATE.
// We keep a stack of states (captured after each action) and step through it: undo restores the
// previous state, redo the next, a new action drops the redo branch. In-memory only (clears on
// reload) and reset per map. Reuses the map's serialize + restore-state endpoints, so it reverses
// ANY action uniformly (add / delete / rename / move / connect / lane change / checklist / …).

import { useCallback, useEffect, useRef, useState } from 'react'
import { processHierarchyApi } from '@/lib/api/process-hierarchy'

const MAX = 25 // cap the stack so a long session can't grow memory without bound

export interface MapHistory {
  record: () => void // call after a committed mutation to push a new history entry
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  busy: boolean // a restore is in flight — disable further undo/redo meanwhile
}

export function useMapHistory(orgId: string, mapId: string, refresh: () => Promise<void> | void): MapHistory {
  const stackRef = useRef<unknown[]>([])
  const ptrRef = useRef(-1)
  const chainRef = useRef<Promise<void>>(Promise.resolve()) // serialize captures so rapid actions record in order
  const restoringRef = useRef(false) // true during an undo/redo restore, so its refresh doesn't record a new entry
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [busy, setBusy] = useState(false)

  const sync = useCallback(() => {
    setCanUndo(ptrRef.current > 0)
    setCanRedo(ptrRef.current >= 0 && ptrRef.current < stackRef.current.length - 1)
  }, [])

  // Capture the current server state as a new history entry (best-effort, off the UI path).
  const capture = useCallback((baseline = false) => {
    if (restoringRef.current) return
    chainRef.current = chainRef.current.then(async () => {
      if (restoringRef.current) return
      if (baseline && stackRef.current.length) return // baseline already taken
      try {
        const blob = await processHierarchyApi.exportState(orgId, mapId)
        stackRef.current = stackRef.current.slice(0, ptrRef.current + 1) // drop any redo branch
        stackRef.current.push(blob)
        if (stackRef.current.length > MAX) stackRef.current.shift()
        ptrRef.current = stackRef.current.length - 1
        sync()
      } catch { /* capturing history is best-effort — never break the edit */ }
    })
  }, [orgId, mapId, sync])

  // Baseline the current state on load / whenever the open map changes.
  useEffect(() => {
    stackRef.current = []
    ptrRef.current = -1
    setCanUndo(false); setCanRedo(false)
    capture(true)
  }, [mapId, orgId, capture])

  const record = useCallback(() => capture(false), [capture])

  const step = useCallback(async (dir: -1 | 1) => {
    if (restoringRef.current) return
    const target = ptrRef.current + dir
    if (target < 0 || target >= stackRef.current.length) return
    setBusy(true)
    restoringRef.current = true
    try {
      await processHierarchyApi.restoreState(orgId, mapId, stackRef.current[target])
      ptrRef.current = target
      await refresh()
      sync()
    } catch { /* leave the pointer where it was on failure */ } finally {
      restoringRef.current = false
      setBusy(false)
    }
  }, [orgId, mapId, refresh, sync])

  const undo = useCallback(() => { void step(-1) }, [step])
  const redo = useCallback(() => { void step(1) }, [step])

  return { record, undo, redo, canUndo, canRedo, busy }
}
