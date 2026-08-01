'use client'

import { Dispatch, SetStateAction, useEffect, useState } from 'react'

function read<T>(key: string, initial: T): T {
  if (typeof window === 'undefined') return initial
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw != null ? (JSON.parse(raw) as T) : initial
  } catch {
    return initial
  }
}

/**
 * Like useState, but the value is persisted to sessionStorage under `key` so it
 * survives leaving the page and coming back within the same tab (e.g. opening a task
 * and navigating back) — while still resetting when the tab is closed. Used to keep
 * the task list's filters / search / sort sticky across drill-in navigation.
 *
 * The stored value is read LAZILY in the useState initializer, so it is already in place
 * on the very first render — there is no window where the default clobbers it. The task
 * list renders a loading spinner on that first render (data not yet fetched), so the
 * restored-vs-default difference never appears in the initial HTML (no hydration issue).
 */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => read(key, initial))

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [key, state])

  return [state, setState]
}
