'use client'

import { useEffect } from 'react'

export default function NoScrollNumberInputs() {
  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.blur()
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: true })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [])

  return null
}
