'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  ArrowRight,
  ArrowLeftRight,
  Eye,
  ShieldAlert,
  Info,
  X,
} from 'lucide-react'
import { tasksApi } from '@/lib/api/tasks'
import { getEmployees } from '@/lib/api/employees'
import { useToast } from '@/components/ui/Toast'
import type {
  AssigneeVisibilityAdminView,
  AssigneeVisibilitySettings,
  AssigneeExceptionScope,
  AssigneeExceptionKind,
  BridgeDepth,
  AssigneeExplainResult,
} from '@/lib/types/tasks'

// Permissions collapsed to Administrators (is_admin) vs Members. 'org_admin'/'employee'
// are the value strings the backend still matches; legacy 'hr_manager' is inert.
const MEMBER_ROLES = ['org_admin', 'employee'] as const
const roleLabel = (r: string) =>
  ({ org_admin: 'Administrators', employee: 'Members', hr_manager: 'HR Manager (legacy)' }[r] ?? r)

interface Person {
  user_id: string
  name: string
}

// ─── Small shared controls ──────────────────────────────────────────────────────

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${on ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

function Chip({ label, active, color = 'blue', onClick }: { label: string; active: boolean; color?: 'blue' | 'red'; onClick: () => void }) {
  const activeCls = color === 'red' ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-[#2563EB] text-white border-[#2563EB]'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border capitalize transition-colors ${active ? activeCls : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB]'}`}
    >
      {label}
    </button>
  )
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-[#0F172A]">{title}</h3>
        {description && <p className="text-[13px] text-[#475569] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function UserMultiSelect({ people, selected, onToggle }: { people: Person[]; selected: string[]; onToggle: (id: string) => void }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(
    () => people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [people, q],
  )
  return (
    <div className="border border-[#CBD5E1] rounded-[8px] overflow-hidden">
      <div className="relative border-b border-[#E2E8F0]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people…"
          className="w-full pl-9 pr-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-[#F1F5F9]">
        {filtered.length === 0 && <p className="px-3 py-3 text-xs text-[#94A3B8]">No people found.</p>}
        {filtered.map((p) => {
          const on = selected.includes(p.user_id)
          return (
            <button
              key={p.user_id}
              type="button"
              onClick={() => onToggle(p.user_id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'}`}
            >
              <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${on ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[#CBD5E1]'}`}>
                {on && <span className="text-white text-[10px] leading-none">✓</span>}
              </span>
              <span className="text-[#0F172A]">{p.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main tab ───────────────────────────────────────────────────────────────────

export function AssigneeVisibilityTab({ orgId }: { orgId: string }) {
  const { addToast } = useToast()
  const [view, setView] = useState<AssigneeVisibilityAdminView | null>(null)
  const [settings, setSettings] = useState<AssigneeVisibilitySettings | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const reload = useCallback(async () => {
    const [v, emps] = await Promise.all([
      tasksApi.getAssigneeVisibility(orgId),
      getEmployees(orgId).catch(() => []),
    ])
    setView(v)
    setSettings(v.settings)
    setPeople(emps.map((e) => ({ user_id: e.user_id, name: e.user?.name ?? 'Unknown' })))
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    reload()
      .catch(() => addToast('Could not load visibility settings', 'error'))
      .finally(() => setLoading(false))
  }, [reload, addToast])

  const apiError = (e: any, fallback: string) => {
    const m = e?.response?.data?.message ?? fallback
    addToast(Array.isArray(m) ? m.join(', ') : m, 'error')
  }

  async function saveSettings() {
    if (!settings) return
    setSavingSettings(true)
    try {
      const s = await tasksApi.updateAssigneeSettings(orgId, settings)
      setSettings(s)
      addToast('Settings saved', 'success')
      reload().catch(() => null)
    } catch (e) {
      apiError(e, 'Could not save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading || !view || !settings) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const depts = view.departments
  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id
  const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const patch = (p: Partial<AssigneeVisibilitySettings>) => setSettings({ ...settings, ...p })
  const overrideOn = settings.master_override

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Default-rules info */}
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Assignee visibility</h2>
          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            aria-label="How the default assignee list works"
            aria-expanded={showRules}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
          >
            <Info size={16} />
          </button>
        </div>

        {showRules && (
          <div className="mt-2 rounded-[12px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-[#0F172A]">How the default list is built</p>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                aria-label="Close"
                className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[#475569] hover:text-[#0F172A] hover:bg-white/60 transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-[#475569] mt-1">
              When no override, bridge, or exception applies, each person&apos;s Assignees &amp; CC list is built from just
              these four things — this is the default for everyone:
            </p>
            <ol className="mt-2.5 space-y-2 text-[#1E293B]">
              <li>
                <span className="font-semibold text-[#0F172A]">1. Themselves.</span> A person can always assign to themselves.
              </li>
              <li>
                <span className="font-semibold text-[#0F172A]">2. Everyone below them.</span> Anyone who reports to them —
                directly or further down the chain — in any department.
              </li>
              <li>
                <span className="font-semibold text-[#0F172A]">3. Their own department.</span> Everyone in the department
                their profile belongs to. The <span className="font-medium">Upward</span> switch decides whether they also
                see people <em>above</em> them inside that same department.
              </li>
              <li>
                <span className="font-semibold text-[#0F172A]">4. Their direct manager.</span> The person they report to is
                always included — even when that manager sits in a different (e.g. parent) department.
              </li>
            </ol>
            <p className="text-[#475569] mt-3">
              Everything else on this page — master override, full-visibility, bridges, and exceptions —
              only widens or narrows this default.
            </p>
          </div>
        )}
      </div>

      {/* 1 — Master override */}
      <Card
        title="Master override — open everything"
        description="When on, every user can assign to every active employee. All rules below are ignored."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <ShieldAlert size={16} className={overrideOn ? 'text-[#D97706]' : 'text-[#94A3B8]'} />
            <span className="text-[#1E293B]">{overrideOn ? 'Override is ON — everyone sees everyone.' : 'Override is off.'}</span>
          </div>
          <Toggle on={overrideOn} onChange={() => patch({ master_override: !overrideOn })} />
        </div>
        {overrideOn && (
          <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#FEF3C7] border border-[#FCD34D] text-[13px] text-[#92400E]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>While the override is on, exceptions, bridges and the upward switch have no effect. Save to apply.</span>
          </div>
        )}
      </Card>

      <div className={overrideOn ? 'opacity-60 pointer-events-none space-y-5' : 'space-y-5'}>
        {/* 2 — Full-visibility list */}
        <Card
          title="Full-visibility list (sees everyone)"
          description="Roles or specific people who can assign to every active employee, beyond their default department + reports. Separate from admin powers."
        >
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Roles with full visibility</label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_ROLES.map((r) => (
                <Chip key={r} label={roleLabel(r)} active={settings.full_visibility_roles.includes(r)} onClick={() => patch({ full_visibility_roles: toggleIn(settings.full_visibility_roles, r) })} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-2">Specific people with full visibility</label>
            <UserMultiSelect people={people} selected={settings.full_visibility_users} onToggle={(id) => patch({ full_visibility_users: toggleIn(settings.full_visibility_users, id) })} />
          </div>
        </Card>
      </div>

      {/* Save (settings group) */}
      <button
        type="button"
        onClick={saveSettings}
        disabled={savingSettings}
        className="flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
      >
        {savingSettings ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {savingSettings ? 'Saving…' : 'Save settings'}
      </button>

      <div className={overrideOn ? 'opacity-60 pointer-events-none space-y-5' : 'space-y-5'}>
        {/* 3 — Per-department upward switch */}
        <UpwardSection orgId={orgId} view={view} onChange={reload} apiError={apiError} />

        {/* 4 — Cross-department bridges */}
        <BridgeSection orgId={orgId} view={view} deptName={deptName} onChange={reload} apiError={apiError} />

        {/* 5 — Exceptions */}
        <ExceptionSection orgId={orgId} view={view} people={people} onChange={reload} apiError={apiError} />
      </div>

      {/* Who can edit */}
      <Card title="Who can change these settings" description="Member roles allowed to edit assignee visibility (override, exceptions, bridges, upward switch).">
        <div className="flex flex-wrap gap-2">
          {MEMBER_ROLES.map((r) => (
            <Chip key={r} label={roleLabel(r)} active={settings.config_roles.includes(r)} onClick={() => patch({ config_roles: toggleIn(settings.config_roles, r) })} />
          ))}
        </div>
        <p className="text-xs text-[#94A3B8]">Saved with "Save settings" above. At least one role is required.</p>
      </Card>

      {/* Explain / preview */}
      <ExplainSection orgId={orgId} people={people} />
    </div>
  )
}

// ─── Section: upward switch ──────────────────────────────────────────────────────

function UpwardSection({ orgId, view, onChange, apiError }: { orgId: string; view: AssigneeVisibilityAdminView; onChange: () => Promise<void>; apiError: (e: any, f: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  async function toggle(deptId: string, allow: boolean) {
    setBusy(deptId)
    try {
      await tasksApi.setDepartmentUpward(orgId, { department_id: deptId, allow })
      await onChange()
    } catch (e) {
      apiError(e, 'Could not update department')
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card title="Upward assignment by department" description="When off, members of that department can assign to their direct manager and below — but not higher up the chain.">
      <div className="max-h-[280px] overflow-y-auto -mr-1 pr-1 divide-y divide-[#F1F5F9]">
        {view.departments.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">{d.name}</p>
              <p className="text-xs text-[#475569]">{d.assignee_allow_upward ? 'Can assign up the chain' : 'Direct manager only (no higher)'}</p>
            </div>
            <div className="flex items-center gap-2">
              {busy === d.id && <Loader2 size={13} className="animate-spin text-[#94A3B8]" />}
              <Toggle on={d.assignee_allow_upward} disabled={busy === d.id} onChange={() => toggle(d.id, !d.assignee_allow_upward)} />
            </div>
          </div>
        ))}
        {view.departments.length === 0 && <p className="text-xs text-[#94A3B8] py-2">No departments configured.</p>}
      </div>
    </Card>
  )
}

// ─── Section: bridges ────────────────────────────────────────────────────────────

function BridgeSection({ orgId, view, deptName, onChange, apiError }: { orgId: string; view: AssigneeVisibilityAdminView; deptName: (id: string) => string; onChange: () => Promise<void>; apiError: (e: any, f: string) => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [depth, setDepth] = useState<BridgeDepth>('whole_dept')
  const [adding, setAdding] = useState(false)
  const [bothBusy, setBothBusy] = useState<string | null>(null)

  // Reverse direction of a bridge, if it already exists as its own entry.
  const reverseOf = (b: AssigneeVisibilityAdminView['bridges'][number]) =>
    view.bridges.find(
      (x) => x.from_department_id === b.to_department_id && x.to_department_id === b.from_department_id,
    )

  // "Both ways" toggle: create the reverse entry (B → A) with the same depth, or remove it.
  // Re-entry is skipped — if the reverse already exists we don't create a duplicate.
  async function setBidirectional(b: AssigneeVisibilityAdminView['bridges'][number], on: boolean) {
    setBothBusy(b.id)
    try {
      const reverse = reverseOf(b)
      if (on && !reverse) {
        await tasksApi.createAssigneeBridge(orgId, {
          from_department_id: b.to_department_id,
          to_department_id: b.from_department_id,
          depth: b.depth,
        })
      } else if (!on && reverse) {
        await tasksApi.deleteAssigneeBridge(orgId, reverse.id)
      }
      await onChange()
    } catch (e) {
      apiError(e, 'Could not update bridge direction')
    } finally {
      setBothBusy(null)
    }
  }

  async function add() {
    if (!from || !to) return
    setAdding(true)
    try {
      await tasksApi.createAssigneeBridge(orgId, { from_department_id: from, to_department_id: to, depth })
      setFrom(''); setTo(''); setDepth('whole_dept')
      await onChange()
    } catch (e) {
      apiError(e, 'Could not create bridge')
    } finally {
      setAdding(false)
    }
  }
  // Deletes the bridge and, if it's bidirectional, its reverse twin too — so removing the
  // single ⇄ row clears the whole pair rather than leaving the hidden reverse behind.
  async function remove(b: AssigneeVisibilityAdminView['bridges'][number]) {
    try {
      await tasksApi.deleteAssigneeBridge(orgId, b.id)
      const reverse = reverseOf(b)
      if (reverse) await tasksApi.deleteAssigneeBridge(orgId, reverse.id)
      await onChange()
    } catch (e) {
      apiError(e, 'Could not delete bridge')
    }
  }

  return (
    <Card title="Cross-department bridges" description="Let one department assign into another. One-directional by default — turn on “Both ways” on an entry to also open the reverse (B → A).">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end pt-1">
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">From</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]">
            <option value="">Select…</option>
            {view.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Into</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB]">
            <option value="">Select…</option>
            {view.departments.filter((d) => d.id !== from).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button type="button" onClick={add} disabled={!from || !to || adding} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors h-[38px]">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#374151] mb-1">Reach into target</label>
        <div className="flex gap-2">
          <Chip label="Whole department" active={depth === 'whole_dept'} onClick={() => setDepth('whole_dept')} />
          <Chip label="Head & senior roles" active={depth === 'head_senior'} onClick={() => setDepth('head_senior')} />
        </div>
      </div>
      {view.bridges.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto -mr-1 pr-1 space-y-2 border-t border-[#F1F5F9] pt-4">
          {view.bridges.map((b) => {
            const bothWays = !!reverseOf(b)
            // Collapse a bidirectional pair into a single ⇄ row — render only the canonical side.
            if (bothWays && b.from_department_id > b.to_department_id) return null
            return (
            <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A] flex-wrap">
                  <span>{b.from_department_name ?? deptName(b.from_department_id)}</span>
                  {bothWays ? <ArrowLeftRight size={14} className="text-[#2563EB]" /> : <ArrowRight size={14} className="text-[#94A3B8]" />}
                  <span>{b.to_department_name ?? deptName(b.to_department_id)}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-2 py-0.5">
                    {b.depth === 'whole_dept' ? 'Whole dept' : 'Head & seniors'}
                  </span>
                </div>
                {b.match_count === 0 ? (
                  <p className="flex items-center gap-1 text-xs text-[#B45309] mt-1">
                    <AlertTriangle size={12} /> Matches 0 people — set a department head or a senior role.
                  </p>
                ) : (
                  <p className="text-xs text-[#475569] mt-1">Currently reaches {b.match_count} {b.match_count === 1 ? 'person' : 'people'}.</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="flex items-center gap-1.5"
                  title={bothWays ? 'Both directions open — turn off to remove the reverse entry' : 'One-directional — turn on to also create the reverse entry (B → A)'}
                >
                  <span className="text-[11px] font-medium text-[#475569] hidden sm:inline">Both ways</span>
                  {bothBusy === b.id ? (
                    <Loader2 size={14} className="animate-spin text-[#94A3B8]" />
                  ) : (
                    <Toggle on={bothWays} disabled={bothBusy === b.id} onChange={() => setBidirectional(b, !bothWays)} />
                  )}
                </div>
                <button type="button" onClick={() => remove(b)} className="p-1.5 rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Section: exceptions ─────────────────────────────────────────────────────────

function ExceptionSection({ orgId, view, people, onChange, apiError }: { orgId: string; view: AssigneeVisibilityAdminView; people: Person[]; onChange: () => Promise<void>; apiError: (e: any, f: string) => void }) {
  const [scope, setScope] = useState<AssigneeExceptionScope>('user')
  const [kind, setKind] = useState<AssigneeExceptionKind>('widen')
  const [scopeUserId, setScopeUserId] = useState('')
  const [scopeRole, setScopeRole] = useState('employee')
  const [scopeDeptId, setScopeDeptId] = useState('')
  const [shortlist, setShortlist] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  function reset() {
    setScope('user'); setKind('widen'); setScopeUserId(''); setScopeRole('employee'); setScopeDeptId(''); setShortlist([])
  }

  async function add() {
    if (scope === 'user' && !scopeUserId) return
    if (scope === 'department' && !scopeDeptId) return
    setAdding(true)
    try {
      await tasksApi.createAssigneeException(orgId, {
        scope,
        kind,
        scope_user_id: scope === 'user' ? scopeUserId : undefined,
        scope_role: scope === 'role' ? scopeRole : undefined,
        scope_department_id: scope === 'department' ? scopeDeptId : undefined,
        member_user_ids: kind === 'narrow' ? shortlist : undefined,
      })
      reset()
      await onChange()
    } catch (e) {
      apiError(e, 'Could not create exception')
    } finally {
      setAdding(false)
    }
  }
  async function remove(id: string) {
    try {
      await tasksApi.deleteAssigneeException(orgId, id)
      await onChange()
    } catch (e) {
      apiError(e, 'Could not delete exception')
    }
  }

  const scopeLabel = (s: AssigneeVisibilityAdminView['exceptions'][number]) => {
    if (s.scope === 'user') return s.scope_user_name ?? 'Unknown user'
    if (s.scope === 'role') return roleLabel(s.scope_role ?? '')
    return s.scope_department_name ?? 'Unknown dept'
  }

  return (
    <Card title="Exceptions" description="Override the default for a specific person, role, or department. Widen = sees everyone (excludes still apply). Narrow = sees only a hand-picked shortlist.">
      {view.exceptions.length > 0 && (
        <div className="space-y-2">
          {view.exceptions.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#475569] bg-white border border-[#E2E8F0] rounded-full px-2 py-0.5">{e.scope}</span>
                  <span className="font-medium text-[#0F172A]">{scopeLabel(e)}</span>
                  <span className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${e.kind === 'widen' ? 'text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]' : 'text-[#7C3AED] bg-[#F5F3FF] border-[#DDD6FE]'}`}>{e.kind}</span>
                </div>
                {e.kind === 'narrow' && (
                  <p className="text-xs text-[#475569] mt-1">
                    Shortlist: {e.members.length ? e.members.map((m) => m.name ?? '—').join(', ') : 'empty (only themselves)'}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => remove(e.id)} className="p-1.5 rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 bg-[#F8FAFC]">
        <p className="text-sm font-semibold text-[#0F172A]">Add exception</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Applies to</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as AssigneeExceptionScope)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]">
              <option value="user">A specific person</option>
              <option value="role">A role</option>
              <option value="department">A department</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">{scope === 'user' ? 'Person' : scope === 'role' ? 'Role' : 'Department'}</label>
            {scope === 'user' && (
              <select value={scopeUserId} onChange={(e) => setScopeUserId(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]">
                <option value="">Select…</option>
                {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
              </select>
            )}
            {scope === 'role' && (
              <select value={scopeRole} onChange={(e) => setScopeRole(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]">
                {MEMBER_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            )}
            {scope === 'department' && (
              <select value={scopeDeptId} onChange={(e) => setScopeDeptId(e.target.value)} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]">
                <option value="">Select…</option>
                {view.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#374151] mb-1">Rule</label>
          <div className="flex gap-2">
            <Chip label="Widen — sees everyone" active={kind === 'widen'} onClick={() => setKind('widen')} />
            <Chip label="Narrow — only a shortlist" active={kind === 'narrow'} onClick={() => setKind('narrow')} />
          </div>
        </div>
        {kind === 'narrow' && (
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Shortlist (who they can assign to)</label>
            <UserMultiSelect people={people} selected={shortlist} onToggle={(id) => setShortlist((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
          </div>
        )}
        <button type="button" onClick={add} disabled={adding} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add exception
        </button>
      </div>
    </Card>
  )
}

// ─── Section: explain / preview ──────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  master_override: 'Master override is on',
  full_visibility: 'On the full-visibility list',
  exception_narrow: 'Narrow exception (shortlist)',
  exception_widen: 'Widen exception (everyone)',
  base_default: 'Base default (department + reports)',
}

function ExplainSection({ orgId, people }: { orgId: string; people: Person[] }) {
  const [userId, setUserId] = useState('')
  const [result, setResult] = useState<AssigneeExplainResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function run(id: string) {
    setUserId(id)
    setResult(null)
    if (!id) return
    setLoading(true)
    try {
      setResult(await tasksApi.explainAssignee(orgId, id))
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Preview — who can this person assign to?" description="Pick someone to see their resolved picker and which rule produced it.">
      <select value={userId} onChange={(e) => run(e.target.value)} className="w-full sm:max-w-xs border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]">
        <option value="">Select a person…</option>
        {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
      </select>

      {loading && <div className="flex items-center gap-2 text-sm text-[#475569]"><Loader2 size={14} className="animate-spin" /> Resolving…</div>}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Eye size={15} className="text-[#2563EB]" />
            <span className="font-medium text-[#0F172A]">Can assign to {result.total} {result.total === 1 ? 'person' : 'people'}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-2 py-0.5">
              {REASON_LABEL[result.trace.reason] ?? result.trace.reason}
            </span>
          </div>
          {!!result.trace.bridges_used?.length && (
            <p className="text-xs text-[#475569]">
              Includes {result.trace.bridges_used.length} bridge target group{result.trace.bridges_used.length !== 1 ? 's' : ''}
              {result.trace.bridges_used.some((b) => b.match_count === 0) && (
                <span className="text-[#B45309]"> — one bridge currently matches 0 people.</span>
              )}
            </p>
          )}
          {result.trace.direct_manager_included && (
            <p className="text-xs text-[#475569]">Includes their direct reporting manager (always assignable, even cross-department).</p>
          )}
          <div className="border border-[#E2E8F0] rounded-[8px] max-h-56 overflow-y-auto divide-y divide-[#F1F5F9]">
            {result.users.map((u) => (
              <div key={u.user_id} className="px-3 py-2 text-sm">
                <span className="font-medium text-[#0F172A]">{u.name}</span>
                <span className="text-xs text-[#475569]"> · {u.role_title} · {u.department_name}</span>
              </div>
            ))}
            {result.users.length === 0 && <p className="px-3 py-3 text-xs text-[#94A3B8]">Nobody (only themselves).</p>}
          </div>
        </div>
      )}
    </Card>
  )
}
