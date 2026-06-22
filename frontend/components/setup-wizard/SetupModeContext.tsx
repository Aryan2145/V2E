'use client'

import { createContext, useContext } from 'react'

/**
 * Setup vs Edit are two different jobs.
 *
 *  - 'setup' — the org's setup is NOT yet complete. The 5 step pages behave as a
 *    linear guided wizard (Save & Continue, sequential sidebar, progress bar).
 *  - 'edit'  — setup IS complete (all 5 steps have data saved at least once).
 *    Each step is a standalone editor: a "Save" that keeps you on the page, a
 *    "Done" that returns to the section's settings page, and a free sidebar menu.
 *
 * The setup layout detects the mode once and shares it here so the step pages
 * don't each re-derive it.
 */
export type SetupMode = 'setup' | 'edit'

export const SetupModeContext = createContext<SetupMode>('setup')

export function useSetupMode(): SetupMode {
  return useContext(SetupModeContext)
}

/**
 * In edit mode, each step's "Done" button returns to that section's page in the
 * Settings → Organization area (the canonical place these sections are viewed).
 */
export const SECTION_SETTINGS_ROUTE: Record<number, string> = {
  1: '/settings/organization/company',
  2: '/settings/organization/culture',
  3: '/settings/organization/structure',
  4: '/settings/organization/roles',
  5: '/settings/organization/employees',
}
