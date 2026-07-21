import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isGovernanceEntitlementKey,
  LEGACY_GOVERNANCE_KEY,
} from '../../access-rights/permission-registry';

/**
 * Maps the first path segment after `/org/:orgId/` to its entitlement key. Only
 * entitlement-controlled areas are listed; any other segment (settings,
 * access-rights, departments, identity, …) is never ceiling-gated. Governance is
 * sold per line item, so its segments map to the finer per-line-item keys.
 */
const SEGMENT_TO_MODULE: Record<string, string> = {
  tasks: 'tasks',
  'task-masters': 'tasks',
  goals: 'goals',
  meetings: 'governance.meetings',
  'work-logs': 'governance.work_logs',
  tickets: 'tickets',
  workflows: 'workflows',
  projects: 'projects',
  delegations: 'delegation',
  learning: 'learning',
  announcements: 'communication',
  bulletin: 'communication',
  knowledge: 'communication',
  messaging: 'communication',
  ecs: 'ecs',
  performance: 'performance',
};

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Enforces org scoping AND the per-org module entitlement ceiling. Runs after
 * JwtAuthGuard on every org-scoped route. A module set to `off` is blocked
 * entirely; `preview` is read-only (writes blocked). Super admins bypass both.
 */
@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.orgId;

    if (!orgId) return true;
    if (user?.isSuperAdmin) return true;

    if (user?.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to this organization');
    }

    // ─── Entitlement ceiling ───────────────────────────────────────────────────
    const segment = this.moduleSegment(request);
    const moduleKey = segment ? SEGMENT_TO_MODULE[segment] : undefined;
    if (moduleKey) {
      let ent = await this.prisma.orgModuleEntitlement.findUnique({
        where: { organization_id_module_key: { organization_id: orgId, module_key: moduleKey } },
        select: { state: true },
      });
      // Governance line items inherit the legacy `governance` row until a super
      // admin saves the finer switches (existing orgs were seeded pre-split).
      if (!ent && isGovernanceEntitlementKey(moduleKey)) {
        ent = await this.prisma.orgModuleEntitlement.findUnique({
          where: {
            organization_id_module_key: {
              organization_id: orgId,
              module_key: LEGACY_GOVERNANCE_KEY,
            },
          },
          select: { state: true },
        });
      }
      const state = ent?.state ?? 'off'; // missing ⇒ off (fail-closed)
      if (state === 'off') {
        throw new ForbiddenException('This module is not enabled for your organization.');
      }
      if (state === 'preview' && WRITE_METHODS.has(request.method)) {
        throw new ForbiddenException('This module is in preview mode (read-only).');
      }
    }
    return true;
  }

  /** The path segment right after `/org/:orgId/`, e.g. "tasks". */
  private moduleSegment(request: any): string | undefined {
    const path: string = request.path ?? request.url ?? '';
    const m = path.match(/\/org\/[^/]+\/([^/?]+)/);
    return m?.[1];
  }
}
