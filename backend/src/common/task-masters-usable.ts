import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Task Masters (category / priority / department) referenced when creating or
 * editing a task — one-time OR recurring — must belong to the caller's own org
 * and (for category/priority) still be active. Skipping this lets a pasted
 * foreign/deactivated id become a stored cross-tenant reference that then
 * propagates onto every spawned instance and pollutes analytics
 * (see backend/AUTHORIZATION.md). Empty/undefined fields are skipped.
 * Throws BadRequest naming the offending catalog.
 *
 * Shared so the recurring service and the canonical tasks service enforce the
 * exact same rule; mirrors the `org-members.ts` helper convention.
 */
export async function assertMastersUsable(
  prisma: PrismaService,
  orgId: string,
  refs: { category_id?: string | null; priority_id?: string | null; department_id?: string | null },
): Promise<void> {
  const checks: Promise<void>[] = [];
  if (refs.category_id) {
    checks.push(
      prisma.taskCategory
        .findFirst({ where: { id: refs.category_id, organization_id: orgId, is_active: true }, select: { id: true } })
        .then((r) => {
          if (!r) throw new BadRequestException('Category not found or no longer active in this organization.');
        }),
    );
  }
  if (refs.priority_id) {
    checks.push(
      prisma.taskPriority
        .findFirst({ where: { id: refs.priority_id, organization_id: orgId, is_active: true }, select: { id: true } })
        .then((r) => {
          if (!r) throw new BadRequestException('Priority not found or no longer active in this organization.');
        }),
    );
  }
  if (refs.department_id) {
    checks.push(
      prisma.department
        .findFirst({ where: { id: refs.department_id, organization_id: orgId }, select: { id: true } })
        .then((r) => {
          if (!r) throw new BadRequestException('Department not found in this organization.');
        }),
    );
  }
  await Promise.all(checks);
}
