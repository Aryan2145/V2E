import { Injectable } from '@nestjs/common';
import { DataScope, PermissionAction } from '@prisma/client';
import { PermissionsService, Principal } from './permissions.service';
import { moduleLabelOf } from './permission-registry';
import { isContentLeaf, scopePolicyOf, SCOPABLE_LEAVES } from './scope-registry';

/**
 * Counts the rows a user is a PARTICIPANT of (owner/creator/assignee/…), IGNORING
 * their data scope. Each scopable module registers one in its constructor so the
 * "do I actually have data here?" question can be answered even when the read gate
 * is closed. Only ever counts the caller's OWN rows — never leaks others' data.
 */
export type AssignedCounter = (orgId: string, userId: string) => Promise<number>;

/** Why a user can't see a module's data (drives the help message). */
export type VisibilityReason = 'ok' | 'no_system_role' | 'role_lacks_permission';

export interface VisibilitySummary {
  leaf: string;
  module_label: string;
  can_read: boolean;
  scope: DataScope | null;
  /** Count of rows assigned to the caller, ignoring scope. null = no counter registered. */
  assigned_count: number | null;
  has_system_role: boolean;
  reason: VisibilityReason;
}

/**
 * The read-side companion to ScopeService: answers "you're being shown an empty
 * module — is it genuinely empty, or are you simply not allowed to see your own
 * data, and if so why?". Powers the system-wide "data hidden by permissions"
 * message. Registered globally in AccessRightsModule.
 */
@Injectable()
export class AccessVisibilityService {
  private readonly counters = new Map<string, AssignedCounter>();

  constructor(private readonly permissions: PermissionsService) {}

  /** A scopable module's list service calls this in its constructor (self-registration). */
  registerCounter(leafKey: string, counter: AssignedCounter): void {
    this.counters.set(leafKey, counter);
  }

  /** Build the participant where-fragment for a single user from the scope registry. */
  whereForUser(leafKey: string, userId: string): Record<string, unknown> | null {
    return scopePolicyOf(leafKey)?.whereForUsers?.([userId]) ?? null;
  }

  async summary(orgId: string, principal: Principal, leafKey: string): Promise<VisibilitySummary> {
    const scope = await this.permissions.scopeFor(orgId, principal, leafKey, PermissionAction.read);
    const canRead = scope !== null;

    const counter = this.counters.get(leafKey);
    const assignedCount = counter ? await counter(orgId, principal.userId) : null;

    const reason: VisibilityReason = canRead
      ? 'ok'
      : principal.systemRoleId
        ? 'role_lacks_permission'
        : 'no_system_role';

    return {
      leaf: leafKey,
      module_label: moduleLabelOf(leafKey) ?? leafKey,
      can_read: canRead,
      scope,
      assigned_count: assignedCount,
      has_system_role: !!principal.systemRoleId,
      reason,
    };
  }

  /** Whether a leaf is a recognised, row-scopable content leaf (guards the endpoint). */
  isScopableLeaf(leafKey: string): boolean {
    return isContentLeaf(leafKey) && SCOPABLE_LEAVES.includes(leafKey);
  }
}
