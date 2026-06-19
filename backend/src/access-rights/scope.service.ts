import {
  ForbiddenException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DataScope, PermissionAction } from '@prisma/client';
import { AssigneeVisibilityService } from '../assignee-visibility/assignee-visibility.service';
import { PermissionsService, Principal } from './permissions.service';
import {
  SCOPABLE_LEAVES,
  scopePolicyOf,
  validateScopeRegistry,
} from './scope-registry';

/** Matches no rows — used to fail closed when an actor may not read a content leaf. */
const DENY_WHERE: Record<string, unknown> = { id: { in: [] as string[] } };

/**
 * Row-level data-scope enforcement. The read-side twin of SubjectEligibilityService:
 *  - `listWhere` produces the Prisma `where` fragment every scopable module's list
 *    query spreads in, so visibility can't be forgotten;
 *  - `assertCanActOn` gates mutations against the actor's per-action scope.
 *
 * Delegates the hierarchy maths to AssigneeVisibilityService (recursive subtree +
 * department members, cached) and the scope resolution to PermissionsService.
 *
 * Fail-loud boot guard: every `scopable` content leaf must be claimed by a wired
 * list handler (its service registers in its constructor) or the app refuses to boot.
 */
@Injectable()
export class ScopeService implements OnApplicationBootstrap {
  private readonly wiredLeaves = new Set<string>();

  constructor(
    private readonly permissions: PermissionsService,
    private readonly visibility: AssigneeVisibilityService,
  ) {}

  /** A scopable module's list service calls this in its constructor (self-registration). */
  registerWiredList(leafKey: string): void {
    this.wiredLeaves.add(leafKey);
  }

  onApplicationBootstrap(): void {
    validateScopeRegistry();
    const unwired = SCOPABLE_LEAVES.filter((l) => !this.wiredLeaves.has(l));
    if (unwired.length) {
      throw new Error(
        `Data-scope boot guard: scopable content leaf(s) [${unwired.join(', ')}] have no wired ` +
          `list handler. Wire ScopeService.listWhere into the module's list query and call ` +
          `registerWiredList() in its constructor, or reclassify the leaf in scope-registry.ts.`,
      );
    }
  }

  /**
   * The set of user ids visible at `scope` for `actorId`, or `'ALL'` for org scope
   * (caller applies no row filter).
   */
  async visibleUserIds(
    orgId: string,
    actorId: string,
    scope: DataScope,
  ): Promise<string[] | 'ALL'> {
    switch (scope) {
      case DataScope.org:
        return 'ALL';
      case DataScope.own:
        return [actorId];
      case DataScope.team:
        return [actorId, ...(await this.visibility.getSubordinateUserIds(orgId, actorId))];
      case DataScope.department: {
        const dept = await this.visibility.getActorDepartmentId(orgId, actorId);
        if (!dept) return [actorId];
        const members = await this.visibility.getDepartmentMemberIds(orgId, dept);
        return members.length ? members : [actorId];
      }
      default:
        return [actorId];
    }
  }

  /**
   * Prisma `where` fragment for a scopable content leaf's list query. Spread into the
   * module's existing `where`. `{}` = no restriction (org scope); DENY = no content.
   */
  async listWhere(
    orgId: string,
    principal: Principal,
    leafKey: string,
  ): Promise<Record<string, unknown>> {
    const scope = await this.permissions.scopeFor(orgId, principal, leafKey, PermissionAction.read);
    if (scope === null) return DENY_WHERE; // denied / superadmin — fail closed
    if (scope === DataScope.org) return {};
    const visible = await this.visibleUserIds(orgId, principal.userId, scope);
    if (visible === 'ALL') return {};
    const policy = scopePolicyOf(leafKey);
    if (!policy?.whereForUsers) return DENY_WHERE;
    return policy.whereForUsers(visible);
  }

  /**
   * Gate a mutation: throws unless the record (identified by its CORE participant user
   * ids) is within the actor's effective scope for `action`. Fail-loud.
   */
  async assertCanActOn(
    orgId: string,
    principal: Principal,
    leafKey: string,
    action: PermissionAction,
    participantUserIds: (string | null | undefined)[],
  ): Promise<void> {
    const scope = await this.permissions.scopeFor(orgId, principal, leafKey, action);
    if (scope === null) {
      throw new ForbiddenException(`You do not have ${action} access to this record`);
    }
    if (scope === DataScope.org) return;
    const visible = await this.visibleUserIds(orgId, principal.userId, scope);
    if (visible === 'ALL') return;
    const allowed = new Set(visible);
    if (participantUserIds.some((id) => id && allowed.has(id))) return;
    throw new ForbiddenException(`This record is outside your ${scope} scope`);
  }
}
