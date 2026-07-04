import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Every user-id list a client sends (escalation contacts, watchers, …) must be
 * ACTIVE members of the caller's own org — otherwise a pasted foreign/stale id
 * becomes a stored cross-tenant reference (see backend/AUTHORIZATION.md).
 * Empty/undefined skips. Throws BadRequest naming the offending role.
 */
export async function assertActiveOrgMembers(
  prisma: PrismaService,
  orgId: string,
  userIds: string[] | undefined | null,
  label: string,
): Promise<void> {
  const ids = Array.from(new Set((userIds ?? []).filter(Boolean)));
  if (ids.length === 0) return;
  const members = await prisma.organizationMember.findMany({
    where: { organization_id: orgId, user_id: { in: ids }, is_active: true },
    select: { user_id: true },
  });
  if (members.length !== ids.length) {
    throw new BadRequestException(`One or more ${label} are not active members of this organization`);
  }
}

/**
 * Non-throwing variant for background jobs (e.g. the recurring spawn engine):
 * returns only the ids that are still active members, preserving order, so a
 * person who left the org is silently skipped instead of aborting the job.
 */
export async function filterActiveOrgMembers(
  prisma: PrismaService,
  orgId: string,
  userIds: string[],
): Promise<string[]> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return [];
  const members = await prisma.organizationMember.findMany({
    where: { organization_id: orgId, user_id: { in: ids }, is_active: true },
    select: { user_id: true },
  });
  const active = new Set(members.map((m) => m.user_id));
  return ids.filter((id) => active.has(id));
}
