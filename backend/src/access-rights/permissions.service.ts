import { Injectable } from '@nestjs/common';
import { DataScope, EntitlementState, PermissionAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALL_ADMIN_LEAVES,
  ALL_FEATURE_LEAVES,
  actionsFor,
  entitlementKeyOf,
  isEntitlementControlled,
  isGovernanceEntitlementKey,
  kindOf,
  LEGACY_GOVERNANCE_KEY,
  moduleOf,
} from './permission-registry';
import { DEFAULT_SCOPE, SCOPABLE_LEAVES, rowScopeOf } from './scope-registry';

/** Scope ordering, narrowest → widest. */
const SCOPE_RANK: Record<DataScope, number> = {
  own: 0,
  team: 1,
  department: 2,
  org: 3,
};
const widestScope = (scopes: DataScope[]): DataScope =>
  scopes.reduce((acc, s) => (SCOPE_RANK[s] > SCOPE_RANK[acc] ? s : acc), DataScope.own);

export interface ResourcePermissions {
  read: boolean;
  write: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * The acting principal, resolved from the JWT/request.
 *  - `systemRoleId` = EmployeeProfile.system_role_id (the access-rights bundle baseline).
 *  - `isAdmin`      = OrganizationMember.is_admin OR the System Role's is_admin flag.
 */
export interface Principal {
  userId: string;
  systemRoleId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/** Build a Principal from the request user (jwt.strategy shape). */
export function principalFromUser(u: {
  id: string;
  system_role_id?: string | null;
  is_admin?: boolean;
  isSuperAdmin?: boolean;
}): Principal {
  return {
    userId: u.id,
    systemRoleId: u.system_role_id ?? null,
    isAdmin: !!u.is_admin,
    isSuperAdmin: !!u.isSuperAdmin,
  };
}

export interface SubjectEligibility {
  eligible: boolean;
  reason?: string;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // FOUR-LAYER RESOLUTION
  // effective = entitlement ∩ ( jobRole_permissions ∪ user_grants − user_revokes )
  // admin leaves are governed by is_admin; subject eligibility is a separate axis.
  // ───────────────────────────────────────────────────────────────────────────

  /** Entitlement ceiling for one module: missing/off ⇒ false; preview ⇒ read-only; full ⇒ true. */
  private ceilingAllows(state: EntitlementState | null | undefined, action: PermissionAction): boolean {
    if (state === 'full') return true;
    if (state === 'preview') return action === 'read';
    return false; // off or missing — fail closed
  }

  private async entitlementState(orgId: string, moduleKey: string): Promise<EntitlementState> {
    const row = await this.prisma.orgModuleEntitlement.findUnique({
      where: { organization_id_module_key: { organization_id: orgId, module_key: moduleKey } },
    });
    if (row) return row.state;
    // Governance split into per-line-item keys after some orgs were already seeded
    // with the single legacy `governance` key. Inherit it until a super admin saves
    // the finer switches (which then create explicit rows).
    if (isGovernanceEntitlementKey(moduleKey)) {
      const legacy = await this.prisma.orgModuleEntitlement.findUnique({
        where: {
          organization_id_module_key: {
            organization_id: orgId,
            module_key: LEGACY_GOVERNANCE_KEY,
          },
        },
      });
      return legacy?.state ?? 'off';
    }
    return 'off';
  }

  /** Bulk-map lookup with the same Governance legacy fallback as `entitlementState`. */
  private ceilingFromMap(
    entByModule: Map<string, EntitlementState>,
    entitlementKey: string,
  ): EntitlementState {
    const direct = entByModule.get(entitlementKey);
    if (direct) return direct;
    if (isGovernanceEntitlementKey(entitlementKey)) {
      return entByModule.get(LEGACY_GOVERNANCE_KEY) ?? 'off';
    }
    return 'off';
  }

  /** Effective allow for one actor leaf + action. */
  async hasEffective(
    orgId: string,
    principal: Principal,
    leafKey: string,
    action: PermissionAction,
  ): Promise<boolean> {
    // Admin leaves — governed by is_admin (or vendor superadmin), never by feature permissions.
    if (kindOf(leafKey) === 'admin') return principal.isAdmin || principal.isSuperAdmin;

    // Vendor superadmin is METADATA-ONLY: never content/feature access. Record content
    // stays inside the org. (Metadata leaves, when they exist, are allowed above/here.)
    if (principal.isSuperAdmin) return false;

    // Layer 1 — entitlement ceiling (module key, or a sub-module's finer key).
    if (isEntitlementControlled(leafKey)) {
      const entKey = entitlementKeyOf(leafKey)!;
      const state = await this.entitlementState(orgId, entKey);
      if (!this.ceilingAllows(state, action)) return false;
    }

    // Org admins are full administrators within their org: every enabled feature
    // (bounded by the entitlement ceiling checked above) is theirs in full —
    // read, write, edit and delete. (Vendor super admins are handled separately.)
    if (principal.isAdmin) return true;

    // Layer 2 + 3 — JobRole baseline overridden by the user's explicit delta.
    const override = await this.prisma.userPermissionOverride.findUnique({
      where: {
        organization_id_user_id_feature_key_action: {
          organization_id: orgId,
          user_id: principal.userId,
          feature_key: leafKey,
          action,
        },
      },
    });
    if (override) return override.effect === 'grant';

    if (!principal.systemRoleId) return false;
    const base = await this.prisma.rolePermission.findUnique({
      where: {
        organization_id_system_role_id_feature_key_action: {
          organization_id: orgId,
          system_role_id: principal.systemRoleId,
          feature_key: leafKey,
          action,
        },
      },
    });
    return base?.allowed ?? false;
  }

  /**
   * All effective actor permissions for a principal, keyed by leaf → {read,write,edit,delete}.
   * Backs `/me` (UI gating) and the per-user override panel. Constant number of queries.
   */
  async resolveEffectiveForUser(
    orgId: string,
    principal: Principal,
  ): Promise<Record<string, ResourcePermissions>> {
    const result: Record<string, ResourcePermissions> = {};

    // Entitlement states for all entitlement-controlled modules in one read.
    const entRows = await this.prisma.orgModuleEntitlement.findMany({
      where: { organization_id: orgId },
    });
    const entByModule = new Map(entRows.map((r) => [r.module_key, r.state]));

    // Admin leaves — is_admin (under no ceiling).
    for (const leaf of ALL_ADMIN_LEAVES) {
      const allow = principal.isSuperAdmin || principal.isAdmin;
      result[leaf.key] = this.permsFromActions(leaf.actions, () => allow);
    }

    // Feature leaves — batch role baseline + user overrides, fold against ceiling.
    const [baseRows, overrideRows] = await Promise.all([
      principal.systemRoleId
        ? this.prisma.rolePermission.findMany({
            where: { organization_id: orgId, system_role_id: principal.systemRoleId },
          })
        : Promise.resolve([]),
      this.prisma.userPermissionOverride.findMany({
        where: { organization_id: orgId, user_id: principal.userId },
      }),
    ]);
    const baseAllow = new Map(baseRows.map((r) => [`${r.feature_key}:${r.action}`, r.allowed]));
    const overrideEffect = new Map(
      overrideRows.map((r) => [`${r.feature_key}:${r.action}`, r.effect]),
    );

    for (const leaf of ALL_FEATURE_LEAVES) {
      const state = isEntitlementControlled(leaf.key)
        ? this.ceilingFromMap(entByModule, entitlementKeyOf(leaf.key)!)
        : 'full';
      result[leaf.key] = this.permsFromActions(leaf.actions, (action) => {
        if (principal.isSuperAdmin) return false; // metadata-only: no content/feature
        if (!this.ceilingAllows(state, action)) return false;
        if (principal.isAdmin) return true; // org admin ⇒ full within the entitlement ceiling
        const ov = overrideEffect.get(`${leaf.key}:${action}`);
        if (ov) return ov === 'grant';
        return baseAllow.get(`${leaf.key}:${action}`) ?? false;
      });
    }
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DATA SCOPE — row-level visibility dimension on a content read/write/edit/delete
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * The effective data scope for a granted action on a scopable content leaf, or
   * `null` if the action isn't allowed / the leaf isn't scopable. Precedence mirrors
   * `hasEffective`: superadmin⇒null (no content); is_admin⇒org on read; else the
   * widest of {granting user-override scope, resolved role-baseline scope}.
   *
   * The role-baseline scope follows the LIVING-DEFAULT cascade for the System Role:
   *   line  (RolePermission.scope)
   *     ?? module (SystemRoleModuleScope.scope for the leaf's module)
   *     ?? global (SystemRole.default_scope)
   *     ?? own
   */
  async scopeFor(
    orgId: string,
    principal: Principal,
    leafKey: string,
    action: PermissionAction,
  ): Promise<DataScope | null> {
    if (rowScopeOf(leafKey) !== 'scopable') return null; // self_scoped / org_default / non-content
    if (principal.isSuperAdmin) return null; // vendor never reads content
    if (!(await this.hasEffective(orgId, principal, leafKey, action))) return null;
    if (principal.isAdmin) return DataScope.org;

    const moduleKey = moduleOf(leafKey);
    const [override, base, role, moduleScope] = await Promise.all([
      this.prisma.userPermissionOverride.findUnique({
        where: {
          organization_id_user_id_feature_key_action: {
            organization_id: orgId,
            user_id: principal.userId,
            feature_key: leafKey,
            action,
          },
        },
      }),
      principal.systemRoleId
        ? this.prisma.rolePermission.findUnique({
            where: {
              organization_id_system_role_id_feature_key_action: {
                organization_id: orgId,
                system_role_id: principal.systemRoleId,
                feature_key: leafKey,
                action,
              },
            },
          })
        : Promise.resolve(null),
      principal.systemRoleId
        ? this.prisma.systemRole.findUnique({
            where: { id: principal.systemRoleId },
            select: { default_scope: true },
          })
        : Promise.resolve(null),
      principal.systemRoleId && moduleKey
        ? this.prisma.systemRoleModuleScope.findUnique({
            where: {
              system_role_id_module_key: {
                system_role_id: principal.systemRoleId,
                module_key: moduleKey,
              },
            },
          })
        : Promise.resolve(null),
    ]);

    const scopes: DataScope[] = [];
    if (override?.effect === 'grant' && override.scope) scopes.push(override.scope);
    if (base?.allowed) {
      scopes.push(base.scope ?? moduleScope?.scope ?? role?.default_scope ?? DEFAULT_SCOPE);
    }
    return scopes.length ? widestScope(scopes) : DEFAULT_SCOPE;
  }

  /**
   * All effective data scopes for a principal, keyed leaf → action → DataScope, for
   * scopable content leaves the user can act on. Additive companion to `/me`. Batched.
   */
  async resolveScopesForUser(
    orgId: string,
    principal: Principal,
  ): Promise<Record<string, Partial<Record<PermissionAction, DataScope>>>> {
    const out: Record<string, Partial<Record<PermissionAction, DataScope>>> = {};
    if (principal.isSuperAdmin) return out; // vendor reads no content

    const [entRows, baseRows, overrideRows, role, moduleScopeRows] = await Promise.all([
      this.prisma.orgModuleEntitlement.findMany({ where: { organization_id: orgId } }),
      principal.systemRoleId
        ? this.prisma.rolePermission.findMany({
            where: { organization_id: orgId, system_role_id: principal.systemRoleId },
          })
        : Promise.resolve([]),
      this.prisma.userPermissionOverride.findMany({
        where: { organization_id: orgId, user_id: principal.userId },
      }),
      principal.systemRoleId
        ? this.prisma.systemRole.findUnique({
            where: { id: principal.systemRoleId },
            select: { default_scope: true },
          })
        : Promise.resolve(null),
      principal.systemRoleId
        ? this.prisma.systemRoleModuleScope.findMany({
            where: { system_role_id: principal.systemRoleId },
          })
        : Promise.resolve([]),
    ]);
    const entByModule = new Map(entRows.map((r) => [r.module_key, r.state]));
    const baseByKey = new Map(baseRows.map((r) => [`${r.feature_key}:${r.action}`, r]));
    const ovByKey = new Map(overrideRows.map((r) => [`${r.feature_key}:${r.action}`, r]));
    const moduleScopeByModule = new Map(moduleScopeRows.map((r) => [r.module_key, r.scope]));
    const defaultScope = role?.default_scope ?? DEFAULT_SCOPE;

    for (const leaf of SCOPABLE_LEAVES) {
      const state = isEntitlementControlled(leaf)
        ? this.ceilingFromMap(entByModule, entitlementKeyOf(leaf)!)
        : 'full';
      // Resolved cascade fallback for this leaf's module (line tier handled per-row below).
      const cascadeScope = moduleScopeByModule.get(moduleOf(leaf)!) ?? defaultScope;
      const perAction: Partial<Record<PermissionAction, DataScope>> = {};
      for (const action of actionsFor(leaf)) {
        if (!this.ceilingAllows(state, action)) continue;
        if (principal.isAdmin) {
          perAction[action] = DataScope.org;
          continue;
        }
        const ov = ovByKey.get(`${leaf}:${action}`);
        const base = baseByKey.get(`${leaf}:${action}`);
        let allowed: boolean;
        let scope: DataScope | null = null;
        if (ov) {
          allowed = ov.effect === 'grant';
          scope = ov.scope ?? null;
        } else {
          allowed = base?.allowed ?? false;
          scope = base?.scope ?? null;
        }
        if (allowed) perAction[action] = scope ?? cascadeScope;
      }
      if (Object.keys(perAction).length) out[leaf] = perAction;
    }
    return out;
  }

  private permsFromActions(
    actions: PermissionAction[],
    allow: (a: PermissionAction) => boolean,
  ): ResourcePermissions {
    return {
      read: actions.includes('read') ? allow('read') : false,
      write: actions.includes('write') ? allow('write') : false,
      edit: actions.includes('edit') ? allow('edit') : false,
      delete: actions.includes('delete') ? allow('delete') : false,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUBJECT ELIGIBILITY — separate axis (can a user be acted upon)
  // ───────────────────────────────────────────────────────────────────────────

  /** Is one user an eligible subject for `subjectKey`? */
  async isEligibleSubject(
    orgId: string,
    subjectKey: string,
    userId: string,
    labelForReason?: string,
  ): Promise<SubjectEligibility> {
    // Module ceiling — if the module is off, no one is a subject of it. Gate on the
    // leaf's entitlement key (per-line-item for Governance, e.g. `governance.meetings`),
    // NOT the top-level module key, which for Governance has no entitlement row.
    if (isEntitlementControlled(subjectKey)) {
      const state = await this.entitlementState(orgId, entitlementKeyOf(subjectKey)!);
      if (state === 'off') {
        return { eligible: false, reason: `${labelForReason ?? 'This module'} is not enabled for this organization` };
      }
    }
    const override = await this.prisma.userSubjectOverride.findUnique({
      where: {
        organization_id_user_id_subject_key: {
          organization_id: orgId,
          user_id: userId,
          subject_key: subjectKey,
        },
      },
    });
    if (override) {
      return override.effect === 'grant'
        ? { eligible: true }
        : { eligible: false, reason: override.reason ?? `Excluded by an administrator` };
    }
    const policy = await this.prisma.subjectEligibilityPolicy.findUnique({
      where: { organization_id_subject_key: { organization_id: orgId, subject_key: subjectKey } },
    });
    const def = policy?.default_eligible ?? true;
    return def
      ? { eligible: true }
      : { eligible: false, reason: `${labelForReason ?? 'This action'} is disabled for this organization` };
  }

  /** Batch subject resolution for pickers — constant queries for any N candidates. */
  async resolveEligibleSubjects(
    orgId: string,
    subjectKey: string,
    candidateUserIds: string[],
    labelForReason?: string,
  ): Promise<Map<string, SubjectEligibility>> {
    const out = new Map<string, SubjectEligibility>();
    if (candidateUserIds.length === 0) return out;

    if (isEntitlementControlled(subjectKey)) {
      const state = await this.entitlementState(orgId, entitlementKeyOf(subjectKey)!);
      if (state === 'off') {
        for (const id of candidateUserIds) {
          out.set(id, { eligible: false, reason: `${labelForReason ?? 'This module'} is not enabled for this organization` });
        }
        return out;
      }
    }

    const [overrides, policy] = await Promise.all([
      this.prisma.userSubjectOverride.findMany({
        where: { organization_id: orgId, subject_key: subjectKey, user_id: { in: candidateUserIds } },
      }),
      this.prisma.subjectEligibilityPolicy.findUnique({
        where: { organization_id_subject_key: { organization_id: orgId, subject_key: subjectKey } },
      }),
    ]);
    const overrideByUser = new Map(overrides.map((o) => [o.user_id, o]));
    const def = policy?.default_eligible ?? true;

    for (const id of candidateUserIds) {
      const ov = overrideByUser.get(id);
      if (ov) {
        out.set(
          id,
          ov.effect === 'grant'
            ? { eligible: true }
            : { eligible: false, reason: ov.reason ?? 'Excluded by an administrator' },
        );
      } else {
        out.set(
          id,
          def
            ? { eligible: true }
            : { eligible: false, reason: `${labelForReason ?? 'This action'} is disabled for this organization` },
        );
      }
    }
    return out;
  }
}
