import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ADMIN_KEY = 'require_admin';

/**
 * Gate an endpoint behind platform administration (OrganizationMember.is_admin).
 * This is the org-scoped counterpart to @SuperAdmin (vendor-level). It governs ONLY
 * platform administration (manage access rights, invite users, system config) and
 * NEVER feature access. Enforced by RolesGuard.
 *
 * @example @RequireAdmin()
 */
export const RequireAdmin = () => SetMetadata(REQUIRE_ADMIN_KEY, true);
