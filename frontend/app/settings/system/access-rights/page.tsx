'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Lock, Loader2, Search, ChevronRight, Users2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import { clearPermissionsCache } from '@/lib/auth/use-permissions'
import {
  getPermissionRegistry,
  getRolePermissions,
  updateRolePermissions,
  getSubjectPolicies,
  updateSubjectPolicies,
  DATA_SCOPES,
  DATA_SCOPE_LABEL,
  type RegistryModule,
  type RoleMatrix,
  type SubjectPolicy,
  type ResourcePerms,
  type PermAction,
  type DataScope,
} from '@/lib/api/permissions'

const ACTION_LABEL: Record<PermAction, string> = {
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  delete: 'Delete',
}
const ALL_ACTIONS: PermAction[] = ['read', 'write', 'edit', 'delete']

type Tab = 'roles' | 'subjects'

// Mutable working copy of the role matrix: roleId → leafKey → ResourcePerms
type Working = Record<string, Record<string, ResourcePerms>>
// Working read-scope copy: roleId → leafKey → DataScope (scopable content leaves)
type WorkingScope = Record<string, Record<string, DataScope>>

function cloneMatrix(m: RoleMatrix): Working {
  const out: Working = {}
  for (const [roleId, leaves] of Object.entries(m.permissions)) {
    out[roleId] = {}
    for (const [leafKey, perms] of Object.entries(leaves)) {
      out[roleId][leafKey] = { ...perms }
    }
  }
  return out
}

// The data-scope dropdown controls the READ (visibility) scope per scopable leaf.
// Other actions default to `own` (fail-closed-narrow) unless configured via the API.
function cloneScopes(m: RoleMatrix): WorkingScope {
  const out: WorkingScope = {}
  for (const roleId of Object.keys(m.permissions)) {
    out[roleId] = {}
    for (const leafKey of m.scopableLeaves ?? []) {
      out[roleId][leafKey] = m.scopes?.[roleId]?.[leafKey]?.read ?? 'own'
    }
  }
  return out
}

export default function AccessRightsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { addToast } = useToast()

  const [tab, setTab] = useState<Tab>('roles')
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  const [registry, setRegistry] = useState<RegistryModule[]>([])
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null)
  const [working, setWorking] = useState<Working>({})
  const [workingScope, setWorkingScope] = useState<WorkingScope>({})
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [roleSearch, setRoleSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const [policies, setPolicies] = useState<SubjectPolicy[]>([])
  const [policyEdits, setPolicyEdits] = useState<Record<string, boolean>>({})
  const [savingPolicies, setSavingPolicies] = useState(false)

  const load = useCallback(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([getPermissionRegistry(orgId), getRolePermissions(orgId), getSubjectPolicies(orgId)])
      .then(([reg, mat, pol]) => {
        setRegistry(reg.modules)
        setMatrix(mat)
        setWorking(cloneMatrix(mat))
        setWorkingScope(cloneScopes(mat))
        if (mat.jobRoles.length) setSelectedRoleId(mat.jobRoles[0].id)
        setPolicies(pol.policies)
        setPolicyEdits(Object.fromEntries(pol.policies.map((p) => [p.subject_key, p.default_eligible])))
      })
      .catch((err) => {
        if (err?.response?.status === 403) setDenied(true)
        else addToast(err?.response?.data?.message ?? 'Failed to load access rights', 'error')
      })
      .finally(() => setLoading(false))
  }, [orgId, addToast])

  useEffect(() => {
    load()
  }, [load])

  // Modules that contain at least one configurable (actor + feature) leaf.
  const actorModules = useMemo(
    () =>
      registry
        .map((m) => ({
          ...m,
          subModules: m.subModules
            .map((s) => ({
              ...s,
              features: s.features.filter((f) => f.axis === 'actor' && f.kind === 'feature'),
            }))
            .filter((s) => s.features.length > 0),
        }))
        .filter((m) => m.subModules.length > 0),
    [registry],
  )

  // All (leafKey, action) pairs for a module — for tri-state header + select-all.
  const modulePairs = useCallback(
    (mod: (typeof actorModules)[number]) => {
      const pairs: { leafKey: string; action: PermAction }[] = []
      mod.subModules.forEach((s) =>
        s.features.forEach((f) => f.actions.forEach((a) => pairs.push({ leafKey: f.key, action: a }))),
      )
      return pairs
    },
    [],
  )

  const scopableSet = useMemo(() => new Set(matrix?.scopableLeaves ?? []), [matrix])
  const isScopable = useCallback((leafKey: string) => scopableSet.has(leafKey), [scopableSet])

  type Entry = { job_role_id: string; feature_key: string; action: PermAction; allowed: boolean; scope?: DataScope | null }
  const changedEntries = useMemo(() => {
    if (!matrix) return [] as Entry[]
    const out: Entry[] = []
    for (const role of matrix.jobRoles) {
      const w = working[role.id]
      const o = matrix.permissions[role.id]
      if (!w || !o) continue
      for (const leafKey of Object.keys(w)) {
        const scopable = scopableSet.has(leafKey)
        const newScope = workingScope[role.id]?.[leafKey] ?? 'own'
        const oldScope = matrix.scopes?.[role.id]?.[leafKey]?.read ?? 'own'
        const scopeChanged = scopable && newScope !== oldScope
        for (const a of ALL_ACTIONS) {
          const allowedChanged = (w[leafKey]?.[a] ?? false) !== (o[leafKey]?.[a] ?? false)
          // The read entry carries the visibility scope; emit it if either changed.
          const carryScope = scopable && a === 'read'
          if (allowedChanged || (carryScope && scopeChanged)) {
            out.push({
              job_role_id: role.id,
              feature_key: leafKey,
              action: a,
              allowed: w[leafKey][a],
              ...(carryScope ? { scope: newScope } : {}),
            })
          }
        }
      }
    }
    return out
  }, [working, workingScope, matrix, scopableSet])

  const dirty = changedEntries.length > 0

  function toggle(roleId: string, leafKey: string, action: PermAction) {
    setWorking((prev) => {
      const role = { ...(prev[roleId] ?? {}) }
      const leaf = { ...(role[leafKey] ?? { read: false, write: false, edit: false, delete: false }) }
      leaf[action] = !leaf[action]
      role[leafKey] = leaf
      return { ...prev, [roleId]: role }
    })
  }

  function setScope(roleId: string, leafKey: string, scope: DataScope) {
    setWorkingScope((prev) => ({
      ...prev,
      [roleId]: { ...(prev[roleId] ?? {}), [leafKey]: scope },
    }))
  }

  function setMany(roleId: string, pairs: { leafKey: string; action: PermAction }[], value: boolean) {
    setWorking((prev) => {
      const role = { ...(prev[roleId] ?? {}) }
      for (const { leafKey, action } of pairs) {
        const leaf = { ...(role[leafKey] ?? { read: false, write: false, edit: false, delete: false }) }
        leaf[action] = value
        role[leafKey] = leaf
      }
      return { ...prev, [roleId]: role }
    })
  }

  // enabled-count per role across all configurable pairs (for the left list)
  const enabledCount = useCallback(
    (roleId: string) => {
      let n = 0
      for (const mod of actorModules) {
        for (const { leafKey, action } of modulePairs(mod)) {
          if (working[roleId]?.[leafKey]?.[action]) n++
        }
      }
      return n
    },
    [actorModules, modulePairs, working],
  )

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateRolePermissions(orgId, changedEntries)
      setMatrix(updated)
      setWorking(cloneMatrix(updated))
      setWorkingScope(cloneScopes(updated))
      clearPermissionsCache(orgId)
      addToast('Role permissions saved', 'success')
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to save permissions', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Subject policies ──────────────────────────────────────────────────────

  const policiesDirty = useMemo(
    () => policies.some((p) => policyEdits[p.subject_key] !== p.default_eligible),
    [policies, policyEdits],
  )

  async function handleSavePolicies() {
    setSavingPolicies(true)
    try {
      const entries = policies.map((p) => ({ subject_key: p.subject_key, default_eligible: policyEdits[p.subject_key] }))
      const updated = await updateSubjectPolicies(orgId, entries)
      setPolicies(updated.policies)
      setPolicyEdits(Object.fromEntries(updated.policies.map((p) => [p.subject_key, p.default_eligible])))
      addToast('Subject eligibility saved', 'success')
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to save', 'error')
    } finally {
      setSavingPolicies(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
  if (denied)
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <div className="w-14 h-14 rounded-[16px] bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
          <Lock size={24} />
        </div>
        <h2 className="text-[18px] font-semibold text-[#0F172A]">No access</h2>
        <p className="text-sm text-[#475569] max-w-sm">
          You don&apos;t have permission to manage access rights. Ask an administrator for access.
        </p>
      </div>
    )

  // group roles by department, filtered by search
  const filteredRoles = (matrix?.jobRoles ?? []).filter((r) =>
    r.title.toLowerCase().includes(roleSearch.trim().toLowerCase()),
  )
  const grouped = filteredRoles.reduce<Record<string, typeof filteredRoles>>((acc, r) => {
    const key = r.department?.name ?? 'No department'
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold text-[#0F172A] leading-tight">
            <ShieldCheck size={24} className="text-[#2563EB]" /> Access Rights
          </h1>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Configure what each job role can do, drilling down to individual features. Per-person
            exceptions are set on the employee&apos;s record.
          </p>
        </div>
        {tab === 'roles' && (
          <Button variant="primary" onClick={handleSave} isLoading={saving} disabled={!dirty || saving}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save changes
          </Button>
        )}
        {tab === 'subjects' && (
          <Button variant="primary" onClick={handleSavePolicies} isLoading={savingPolicies} disabled={!policiesDirty || savingPolicies}>
            {savingPolicies && <Loader2 size={15} className="animate-spin" />}
            Save changes
          </Button>
        )}
      </div>

      {/* Admin note */}
      <div className="flex items-center gap-2 bg-[#EFF6FF] border border-[#BAE6FD] rounded-[10px] px-4 py-2.5 mb-5 text-sm text-[#0369A1]">
        <Lock size={15} /> Administrators always have platform-admin rights and aren&apos;t configured here.
        Job roles govern feature access; the admin flag is separate.
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-[8px] border border-[#E2E8F0] overflow-hidden mb-5">
        {(['roles', 'subjects'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors',
              tab === t ? 'bg-[#2563EB] text-white' : 'bg-white text-[#475569] hover:bg-[#F8FAFC]',
            ].join(' ')}
          >
            {t === 'roles' ? 'Role permissions' : 'Subject eligibility'}
          </button>
        ))}
      </div>

      {tab === 'roles' &&
        (matrix && matrix.jobRoles.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-16 bg-white border border-[#E2E8F0] rounded-[12px]">
            <Users2 size={28} className="text-[#94A3B8]" />
            <h2 className="text-base font-semibold text-[#0F172A]">No job roles yet</h2>
            <p className="text-sm text-[#475569] max-w-sm">
              Create job roles in your organization setup, then configure their permissions here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left: roles list */}
            <div className="lg:w-[260px] shrink-0">
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search roles…"
                  className="w-full pl-9 pr-3 py-2 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden max-h-[70vh] overflow-y-auto">
                {Object.entries(grouped).map(([dept, roles]) => (
                  <div key={dept}>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">{dept}</p>
                    {roles.map((r) => {
                      const active = r.id === selectedRoleId
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRoleId(r.id)}
                          className={[
                            'w-full text-left px-4 py-2.5 border-l-[3px] transition-colors',
                            active ? 'bg-[#EFF6FF] border-[#2563EB]' : 'bg-white border-transparent hover:bg-[#F8FAFC]',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={['text-sm font-medium truncate', active ? 'text-[#1D4ED8]' : 'text-[#0F172A]'].join(' ')}>
                              {r.title}
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold text-[#64748B] bg-[#F1F5F9] rounded-[999px] px-2 py-0.5">
                              {enabledCount(r.id)}
                            </span>
                          </div>
                          {r.level && <span className="text-[11px] text-[#94A3B8] capitalize">{r.level}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {filteredRoles.length === 0 && (
                  <p className="px-4 py-6 text-sm text-[#94A3B8] text-center">No roles match.</p>
                )}
              </div>
            </div>

            {/* Right: drill-down */}
            <div className="flex-1 min-w-0">
              {selectedRoleId ? (
                <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
                  {/* column header */}
                  <div className="flex items-center border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <span className="flex-1 text-xs font-semibold text-[#475569] uppercase tracking-wider">Feature</span>
                    <div className="hidden sm:flex">
                      {ALL_ACTIONS.map((a) => (
                        <span key={a} className="w-16 text-center text-xs font-semibold text-[#475569] uppercase tracking-wider">
                          {ACTION_LABEL[a]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {actorModules.map((mod) => {
                    const pairs = modulePairs(mod)
                    const onCount = pairs.filter((p) => working[selectedRoleId]?.[p.leafKey]?.[p.action]).length
                    const allOn = onCount === pairs.length && pairs.length > 0
                    const isCollapsed = collapsed[mod.key]
                    return (
                      <div key={mod.key} className="border-b border-[#F1F5F9] last:border-0">
                        {/* module header */}
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FCFDFE]">
                          <button
                            onClick={() => setCollapsed((c) => ({ ...c, [mod.key]: !c[mod.key] }))}
                            className="flex items-center gap-1.5 flex-1 text-left"
                          >
                            <ChevronRight
                              size={15}
                              className={['text-[#94A3B8] transition-transform', isCollapsed ? '' : 'rotate-90'].join(' ')}
                            />
                            <span className="text-sm font-semibold text-[#0F172A]">{mod.label}</span>
                            <span className="text-[11px] text-[#94A3B8]">
                              {onCount}/{pairs.length}
                            </span>
                          </button>
                          <button
                            onClick={() => setMany(selectedRoleId, pairs, !allOn)}
                            className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                          >
                            {allOn ? 'Clear all' : 'Select all'}
                          </button>
                        </div>

                        {!isCollapsed &&
                          mod.subModules.map((sub) => (
                            <div key={sub.key}>
                              {mod.subModules.length > 1 && (
                                <p className="px-4 pt-2 pb-1 pl-9 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                                  {sub.label}
                                </p>
                              )}
                              {sub.features.map((f) => (
                                <div
                                  key={f.key}
                                  className="flex items-center px-4 py-2.5 pl-9 border-t border-[#F8FAFC] hover:bg-[#FCFDFE]"
                                >
                                  <div className="flex-1 min-w-0 pr-3">
                                    <p className="text-sm font-medium text-[#0F172A]">{f.label}</p>
                                    {f.description && <p className="text-xs text-[#64748B] mt-0.5">{f.description}</p>}
                                    {isScopable(f.key) && (
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                                          Visibility
                                        </span>
                                        <select
                                          aria-label={`${f.label} data scope`}
                                          value={workingScope[selectedRoleId]?.[f.key] ?? 'own'}
                                          disabled={!working[selectedRoleId]?.[f.key]?.read}
                                          onChange={(e) => setScope(selectedRoleId, f.key, e.target.value as DataScope)}
                                          className="text-xs border border-[#CBD5E1] rounded-[6px] px-2 py-1 bg-white text-[#0F172A] focus:outline-none focus:border-[#2563EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
                                        >
                                          {DATA_SCOPES.map((s) => (
                                            <option key={s} value={s}>
                                              {DATA_SCOPE_LABEL[s]}
                                            </option>
                                          ))}
                                        </select>
                                        <span className="text-[11px] text-[#94A3B8]">which records they can see</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex">
                                    {ALL_ACTIONS.map((a) => {
                                      const supported = f.actions.includes(a)
                                      return (
                                        <div key={a} className="w-16 flex items-center justify-center">
                                          {supported ? (
                                            <input
                                              type="checkbox"
                                              aria-label={`${f.label} ${a}`}
                                              checked={working[selectedRoleId]?.[f.key]?.[a] ?? false}
                                              onChange={() => toggle(selectedRoleId, f.key, a)}
                                              className="w-4 h-4 accent-[#2563EB] cursor-pointer"
                                            />
                                          ) : (
                                            <span className="text-[#CBD5E1]">—</span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    )
                  })}
                  {actorModules.length === 0 && (
                    <p className="px-4 py-8 text-sm text-[#94A3B8] text-center">No configurable features.</p>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-8 text-center text-sm text-[#94A3B8]">
                  Select a role to configure its permissions.
                </div>
              )}
            </div>
          </div>
        ))}

      {tab === 'subjects' && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden max-w-2xl">
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <p className="text-sm text-[#475569]">
              Who can be acted upon by others (e.g. assigned a task), independent of whether they can open
              the module themselves. Per-person exceptions are set on the employee&apos;s record.
            </p>
          </div>
          {policies.map((p) => {
            const on = policyEdits[p.subject_key]
            return (
              <div key={p.subject_key} className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#F8FAFC] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">{p.label}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {on ? 'Everyone eligible unless revoked' : 'No one eligible unless granted'}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  onClick={() => setPolicyEdits((e) => ({ ...e, [p.subject_key]: !e[p.subject_key] }))}
                  className={[
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    on ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                      on ? 'translate-x-5' : '',
                    ].join(' ')}
                  />
                </button>
              </div>
            )
          })}
          {policies.length === 0 && <p className="px-5 py-8 text-sm text-[#94A3B8] text-center">No subject permissions defined.</p>}
        </div>
      )}
    </div>
  )
}
