import { Prisma } from '@prisma/client';

/**
 * Default Task Masters seeded into every org: the TaskMaster config row plus the
 * default priorities and statuses a brand-new firm needs before anyone can
 * create a task.
 *
 * These were historically seeded lazily by `getOrCreateConfig` (only when the
 * Tasks → Masters page was first opened), which left the Create Task status
 * dropdown empty for a freshly provisioned org. This helper lets us seed them
 * up-front inside the org-creation transaction instead.
 *
 * Idempotent and additive: priorities/statuses are only seeded when none exist
 * for the org, so re-running never clobbers admin-customized masters.
 *
 * `tx` is a Prisma transaction client (or the PrismaClient itself in scripts).
 */

const DEFAULT_PRIORITIES = [
  { label: 'Critical', color: '#DC2626', order_index: 0 },
  { label: 'High', color: '#EA580C', order_index: 1 },
  { label: 'Medium', color: '#D97706', order_index: 2 },
  { label: 'Low', color: '#2563EB', order_index: 3 },
];

const DEFAULT_STATUSES = [
  { label: 'Not Started', type: 'not_started', color: '#6B7280', order_index: 0, is_default: true },
  { label: 'In Progress', type: 'in_progress', color: '#2563EB', order_index: 1 },
  { label: 'Completed', type: 'completed', color: '#16A34A', order_index: 2 },
  // Terminal "some did, some couldn't" outcome for all_must_complete tasks (auto-set).
  { label: 'Partially Completed', type: 'partially_completed', color: '#EA580C', order_index: 3 },
  { label: 'Incomplete', type: 'incomplete', color: '#DC2626', order_index: 4 },
];

export async function seedTaskMasters(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  await tx.taskMaster.upsert({
    where: { organization_id: organizationId },
    create: { organization_id: organizationId },
    update: {},
  });

  const priorityCount = await tx.taskPriority.count({
    where: { organization_id: organizationId },
  });
  if (priorityCount === 0) {
    await tx.taskPriority.createMany({
      data: DEFAULT_PRIORITIES.map((p) => ({ organization_id: organizationId, ...p })),
    });
  }

  const statusCount = await tx.taskStatus.count({
    where: { organization_id: organizationId },
  });
  if (statusCount === 0) {
    await tx.taskStatus.createMany({
      data: DEFAULT_STATUSES.map((s) => ({ organization_id: organizationId, ...s })),
    });
  }
}
