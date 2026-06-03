'use client'

import { useEffect, useState } from 'react'
import type { ClockState } from './api/clock'

/**
 * Client-side mirror of a test org's simulated clock.
 *
 * For logic (overdue checks, "due this week", etc.) call `getNow()` directly at
 * compute time — it returns the simulated instant for test orgs, or the real
 * `new Date()` otherwise. For a live ticking *display* use the `useNow()` hook.
 */

interface SimState {
  active: boolean
  baseSimMs: number // simulated time at the moment we synced
  baseLocalMs: number // local wall-clock at the moment we synced
}

let sim: SimState = { active: false, baseSimMs: 0, baseLocalMs: 0 }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** The effective "now" — simulated for active test orgs, real otherwise. */
export function getNow(): Date {
  if (!sim.active) return new Date()
  return new Date(sim.baseSimMs + (Date.now() - sim.baseLocalMs))
}

export function isSimActive(): boolean {
  return sim.active
}

/** Sync the local clock from a server clock state (call after fetch/set/reset). */
export function syncClock(state: ClockState | null) {
  if (state && state.is_test && state.sim_epoch) {
    sim = { active: true, baseSimMs: Date.parse(state.simulated_now), baseLocalMs: Date.now() }
  } else {
    sim = { active: false, baseSimMs: 0, baseLocalMs: 0 }
  }
  emit()
}

/** Live ticking clock for display. Re-renders every `intervalMs` while simulating. */
export function useNow(intervalMs = 1000): Date {
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    listeners.add(bump)
    const id = setInterval(bump, intervalMs)
    return () => {
      listeners.delete(bump)
      clearInterval(id)
    }
  }, [intervalMs])
  return getNow()
}
