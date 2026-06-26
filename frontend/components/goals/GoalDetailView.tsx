'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Target,
  User,
  CalendarDays,
  Building2,
  CornerLeftUp,
  ListChecks,
  Activity,
  CircleCheckBig,
  CalendarClock,
  History,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { goalsApi } from '@/lib/api/goals'
import { getEmployees } from '@/lib/api/employees'
import { getDepartments } from '@/lib/api/departments'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CADENCE_META, LEVEL_META, type Goal } from '@/lib/types/goals'
import {
  GoalStatusBadge,
  PerspectiveBadge,
  ConfidenceBadge,
  ProgressBar,
  EmptyState,
  formatDate,
  useGoalPermissions,
} from './shared'
import CreateGoalModal from './CreateGoalModal'
import EditGoalModal from './EditGoalModal'
import AddInitiativeModal from './AddInitiativeModal'
import CheckInModal from './CheckInModal'
import MeasureTrajectory from './MeasureTrajectory'
import GoalCascade from './GoalCascade'
import AccessHiddenState from '@/components/ui/AccessHiddenState'

export default function GoalDetailView({ goalId }: { goalId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const { perms, loading: permsLoading } = useGoalPermissions(orgId)

  const [goal, setGoal] = useState<Goal | null>(null)
  const [employees, setEmployees] = useState<
    { user_id: string; name: string; role_title?: string | null; department_name?: string | null }[]
  >([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { addToast } = useToast()

  const load = useCallback(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      goalsApi.get(orgId, goalId).catch(() => null),
      getEmployees(orgId).catch(() => []),
      getDepartments(orgId).catch(() => []),
    ])
      .then(([g, emps, depts]: any[]) => {
        if (!g) {
          setNotFound(true)
          return
        }
        setGoal(g)
        setEmployees(
          (emps as any[]).map((e) => ({
            user_id: e.user_id,
            name: e.user?.name ?? e.name ?? e.email ?? 'Unknown',
            role_title: e.role?.title ?? null,
            department_name: e.department?.name ?? null,
          })),
        )
        setDepartments((depts as any[]).map((d) => ({ id: d.id, name: d.name })))
      })
      .finally(() => setLoading(false))
  }, [orgId, goalId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!goal) return
    setDeleting(true)
    try {
      await goalsApi.remove(orgId, goal.id)
      addToast('Goal deleted', 'success')
      router.push(`/goals/${goal.level === 'objective' ? 'objectives' : goal.level === 'annual' ? 'annual' : 'quarterly'}`)
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to delete goal', 'error')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || permsLoading) return <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
  // Denied read (the API 403s before the goal loads) → explain access, don't cry "not found".
  if (!perms.read) return <AccessHiddenState orgId={orgId} leaf="goals" moduleLabel="Goals" />
  if (notFound || !goal)
    return (
      <EmptyState
        icon={<Target size={26} />}
        title="Goal not found"
        subtitle="This goal may have been deleted."
        action={
          <Link href="/goals/objectives" className="text-sm font-medium text-[#2563EB] hover:underline">
            Back to goals
          </Link>
        }
      />
    )

  const meta = LEVEL_META[goal.level]
  const childLevel = meta.child
  const backHref = `/goals/${goal.level === 'objective' ? 'objectives' : goal.level === 'annual' ? 'annual' : 'quarterly'}`

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb — back mirrors the forward navigation: return to wherever the
          user came from (parent objective, list, etc.). Fall back to the level
          list on a fresh load / refresh with no in-app history to step back to. */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) router.back()
          else router.push(backHref)
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0F172A] w-fit"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{meta.label}</span>
              <PerspectiveBadge perspective={goal.perspective} />
              <GoalStatusBadge status={goal.status} />
              <ConfidenceBadge confidence={goal.last_confidence} />
            </div>
            <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">{goal.title}</h1>
            {goal.description && <p className="text-[15px] text-[#1E293B] mt-2 leading-relaxed">{goal.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {perms.edit && (
              <button
                onClick={() => setCheckInOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8]"
              >
                <Activity size={15} /> Check in
              </button>
            )}
            {perms.edit && (
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF]"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
            {perms.delete && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] border border-[#FECACA] rounded-[8px] hover:bg-[#FEF2F2]"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#E2E8F0]">
          <Meta icon={<User size={15} />} label="Owner" value={goal.owner?.name ?? '—'} />
          <Meta icon={<CalendarDays size={15} />} label="Due date" value={formatDate(goal.due_date)} />
          <Meta icon={<Building2 size={15} />} label="Department" value={goal.department?.name ?? '—'} />
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">Progress</p>
            <ProgressBar value={goal.progress_percent} />
          </div>
        </div>

        {/* Review rhythm strip — the cadence that makes ownership real */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-[#E2E8F0]">
          <ReviewStat
            icon={<CircleCheckBig size={14} />}
            label="Last check-in"
            value={goal.last_check_in_at ? formatDate(goal.last_check_in_at) : 'Never'}
            tone={goal.last_check_in_at ? 'normal' : 'muted'}
          />
          <ReviewStat
            icon={<CalendarClock size={14} />}
            label="Cadence"
            value={CADENCE_META[goal.review_cadence].label}
            tone={goal.review_cadence === 'none' ? 'muted' : 'normal'}
          />
          <ReviewStat
            icon={<CalendarDays size={14} />}
            label="Next review"
            value={goal.next_review_date ? formatDate(goal.next_review_date) : '—'}
            tone={
              goal.next_review_date && new Date(goal.next_review_date) < new Date() ? 'overdue' : 'normal'
            }
          />
        </div>
      </div>

      {/* Measures & trajectory */}
      <Section
        title="Measures & trajectory"
        icon={<Target size={16} />}
        action={
          perms.edit && goal.measures && goal.measures.length > 0 ? (
            <button
              onClick={() => setCheckInOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px]"
            >
              <Activity size={15} /> Check in
            </button>
          ) : undefined
        }
      >
        {goal.measures && goal.measures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {goal.measures.map((m) => (
              <MeasureTrajectory key={m.id} measure={m} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">
            No measures defined. Add measures (in Edit) so each check-in can track actuals against a target.
          </p>
        )}
      </Section>

      {/* Check-in history — the heartbeat */}
      <Section title="Check-in history" icon={<History size={16} />}>
        {goal.check_ins && goal.check_ins.length > 0 ? (
          <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
            {goal.check_ins.map((ci) => {
              const measureById = new Map((goal.measures ?? []).map((m) => [m.id, m]))
              return (
                <div key={ci.id} className="border border-[#E2E8F0] rounded-[10px] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-[#0F172A]">{formatDate(ci.check_in_date)}</span>
                      <ConfidenceBadge confidence={ci.confidence} />
                      <span className="text-xs font-medium text-[#475569]">{ci.progress_percent}% progress</span>
                    </div>
                    {ci.created_by?.name && (
                      <span className="text-xs text-[#94A3B8]">by {ci.created_by.name}</span>
                    )}
                  </div>
                  {ci.status_note && <p className="text-sm text-[#1E293B] mt-2 leading-relaxed">{ci.status_note}</p>}
                  {ci.measure_values && ci.measure_values.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {ci.measure_values.map((mv) => {
                        const m = measureById.get(mv.goal_measure_id)
                        return (
                          <span
                            key={mv.id}
                            className="inline-flex items-center gap-1 text-xs rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[#475569]"
                          >
                            <span className="font-medium text-[#0F172A]">{m?.name ?? 'Measure'}:</span>
                            {mv.value}
                            {m?.unit ? ` ${m.unit}` : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">
            No check-ins yet. Use <span className="font-medium text-[#475569]">Check in</span> to record the first
            actuals and a confidence call.
          </p>
        )}
      </Section>

      {/* Line of sight: parent (up) */}
      {goal.parent && (
        <Section title="Line of sight — parent" icon={<CornerLeftUp size={16} />}>
          <RowLink onClick={() => router.push(`/goals/${goal.parent!.id}`)}>
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{LEVEL_META[goal.parent.level].label}</p>
              <p className="text-[15px] font-medium text-[#0F172A] mt-0.5">{goal.parent.title}</p>
            </div>
            <ChevronRight size={16} className="text-[#CBD5E1]" />
          </RowLink>
        </Section>
      )}

      {/* Line of sight: children (down) */}
      {childLevel && (
        <Section
          title={`${LEVEL_META[childLevel].plural} under this goal`}
          icon={<ListChecks size={16} />}
          action={
            perms.write ? (
              <button
                onClick={() => setAddChildOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px]"
              >
                <Plus size={15} /> Add {LEVEL_META[childLevel].label}
              </button>
            ) : undefined
          }
        >
          {goal.children && goal.children.length > 0 ? (
            <>
              <p className="text-xs text-[#94A3B8] mb-3 -mt-1">
                Expand a row to drill into its {LEVEL_META[childLevel].plural.toLowerCase()}
                {LEVEL_META[childLevel].child ? ` and ${LEVEL_META[LEVEL_META[childLevel].child].plural.toLowerCase()}` : ' and tasks'} — all in place.
              </p>
              <GoalCascade orgId={orgId} goals={goal.children} />
            </>
          ) : (
            <p className="text-sm text-[#94A3B8]">
              No {LEVEL_META[childLevel].plural.toLowerCase()} yet.
            </p>
          )}
        </Section>
      )}

      {/* Linked tasks (quarterly only) */}
      {goal.level === 'quarterly' && (
        <Section
          title="Initiatives (linked tasks)"
          icon={<ListChecks size={16} />}
          action={
            perms.write ? (
              <button
                onClick={() => setAddTaskOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px]"
              >
                <Plus size={15} /> Add initiative
              </button>
            ) : undefined
          }
        >
          {goal.tasks && goal.tasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {goal.tasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 border border-[#E2E8F0] rounded-[10px] px-4 py-3">
                  <p className="text-[15px] text-[#0F172A] font-medium truncate">{t.title}</p>
                  {t.status?.name && (
                    <span
                      className="text-[12px] font-medium rounded-full px-2.5 py-0.5 border whitespace-nowrap"
                      style={{
                        backgroundColor: t.status.color ? `${t.status.color}1A` : '#F1F5F9',
                        color: t.status.color ?? '#475569',
                        borderColor: '#E2E8F0',
                      }}
                    >
                      {t.status.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#94A3B8]">No initiatives linked yet.</p>
          )}
        </Section>
      )}

      {/* Modals */}
      <EditGoalModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        orgId={orgId}
        goal={goal}
        employees={employees}
        departments={departments}
        onSaved={() => load()}
      />
      <CheckInModal
        isOpen={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        orgId={orgId}
        goal={goal}
        onSaved={() => load()}
      />
      {childLevel && (
        <CreateGoalModal
          isOpen={addChildOpen}
          onClose={() => setAddChildOpen(false)}
          orgId={orgId}
          level={childLevel}
          parent={goal}
          employees={employees}
          departments={departments}
          onCreated={() => load()}
        />
      )}
      {goal.level === 'quarterly' && (
        <AddInitiativeModal
          isOpen={addTaskOpen}
          onClose={() => setAddTaskOpen(false)}
          orgId={orgId}
          goalId={goal.id}
          employees={employees}
          onCreated={() => load()}
        />
      )}

      {/* Delete confirmation */}
      <Modal isOpen={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Delete goal" size="sm">
        <p className="text-sm text-[#1E293B]">Are you sure? This can&apos;t be undone.</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleting} disabled={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">{label}</p>
      <p className="flex items-center gap-1.5 text-[15px] text-[#0F172A]">
        <span className="text-[#94A3B8]">{icon}</span>
        {value}
      </p>
    </div>
  )
}

function ReviewStat({
  icon,
  label,
  value,
  tone = 'normal',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'normal' | 'muted' | 'overdue'
}) {
  const color = tone === 'overdue' ? '#DC2626' : tone === 'muted' ? '#94A3B8' : '#0F172A'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#94A3B8]">{icon}</span>
      <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold text-[#0F172A]">
          <span className="text-[#2563EB]">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function RowLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 border border-[#E2E8F0] rounded-[10px] px-4 py-3 hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors text-left"
    >
      {children}
    </button>
  )
}
