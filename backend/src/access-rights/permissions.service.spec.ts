import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService, Principal } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataScope, EntitlementState, PermissionAction } from '@prisma/client';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      orgModuleEntitlement: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      userPermissionOverride: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      rolePermission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      systemRole: {
        findUnique: jest.fn(),
      },
      systemRoleModuleScope: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      userSubjectOverride: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      subjectEligibilityPolicy: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  describe('hasEffective', () => {
    const orgId = 'org-1';
    const principalUser: Principal = {
      userId: 'user-1',
      systemRoleId: 'role-1',
      isAdmin: false,
      isSuperAdmin: false,
    };
    const principalAdmin: Principal = {
      userId: 'user-admin',
      systemRoleId: 'role-admin',
      isAdmin: true,
      isSuperAdmin: false,
    };
    const principalSuperAdmin: Principal = {
      userId: 'user-sa',
      systemRoleId: null,
      isAdmin: false,
      isSuperAdmin: true,
    };

    it('should allow admin actions for admin and superadmin users on admin leaves', async () => {
      // 'access_rights' is an admin leaf
      const isAllowedAdmin = await service.hasEffective(orgId, principalAdmin, 'access_rights', PermissionAction.write);
      const isAllowedSA = await service.hasEffective(orgId, principalSuperAdmin, 'access_rights', PermissionAction.write);
      const isAllowedUser = await service.hasEffective(orgId, principalUser, 'access_rights', PermissionAction.write);

      expect(isAllowedAdmin).toBe(true);
      expect(isAllowedSA).toBe(true);
      expect(isAllowedUser).toBe(false);
    });

    it('should block superadmin users from feature leaves', async () => {
      // 'tasks.task.manage' is a feature leaf
      const isAllowed = await service.hasEffective(orgId, principalSuperAdmin, 'tasks.task.manage', PermissionAction.read);
      expect(isAllowed).toBe(false);
    });

    it('should respect entitlement ceilings for feature leaves', async () => {
      // Mock entitlementState for 'tasks' module as 'off'
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.off });

      const isAllowed = await service.hasEffective(orgId, principalUser, 'tasks.task.manage', PermissionAction.read);
      expect(isAllowed).toBe(false);
      expect(prismaMock.orgModuleEntitlement.findUnique).toHaveBeenCalledWith({
        where: { organization_id_module_key: { organization_id: orgId, module_key: 'tasks' } },
      });
    });

    it('should allow org admins full access to enabled modules', async () => {
      // Mock entitlementState for 'tasks' module as 'full'
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });

      const isAllowed = await service.hasEffective(orgId, principalAdmin, 'tasks.task.manage', PermissionAction.read);
      expect(isAllowed).toBe(true);
    });

    it('should respect preview mode entitlement ceilings (read-only)', async () => {
      // Mock entitlementState for 'tasks' module as 'preview'
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.preview });

      const isAllowedRead = await service.hasEffective(orgId, principalUser, 'tasks.task.manage', PermissionAction.read);
      const isAllowedWrite = await service.hasEffective(orgId, principalUser, 'tasks.task.manage', PermissionAction.write);

      expect(isAllowedRead).toBe(false); // Still depends on baseline/override
      expect(isAllowedWrite).toBe(false); // Ceiling strictly blocks write
    });

    it('should respect explicit user overrides over role baselines', async () => {
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });
      
      // Override explicitly grants write
      prismaMock.userPermissionOverride.findUnique.mockResolvedValue({ effect: 'grant' });

      const isAllowed = await service.hasEffective(orgId, principalUser, 'tasks.task.manage', PermissionAction.write);
      expect(isAllowed).toBe(true);
      expect(prismaMock.userPermissionOverride.findUnique).toHaveBeenCalled();
      expect(prismaMock.rolePermission.findUnique).not.toHaveBeenCalled();
    });

    it('should fallback to role permissions when no user overrides exist', async () => {
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });
      prismaMock.userPermissionOverride.findUnique.mockResolvedValue(null);
      
      // Role permission allows read
      prismaMock.rolePermission.findUnique.mockResolvedValue({ allowed: true });

      const isAllowed = await service.hasEffective(orgId, principalUser, 'tasks.task.manage', PermissionAction.read);
      expect(isAllowed).toBe(true);
      expect(prismaMock.rolePermission.findUnique).toHaveBeenCalled();
    });
  });

  describe('scopeFor', () => {
    const orgId = 'org-1';
    const principal: Principal = {
      userId: 'user-1',
      systemRoleId: 'role-1',
      isAdmin: false,
      isSuperAdmin: false,
    };

    it('should return org scope for org admins', async () => {
      const admin: Principal = { ...principal, isAdmin: true };
      
      // Mock hasEffective checks to pass
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });
      
      const scope = await service.scopeFor(orgId, admin, 'tasks.task.manage', PermissionAction.read);
      expect(scope).toBe(DataScope.org);
    });

    it('should resolve data scope using cascade hierarchy (user override -> line baseline -> module cascade -> default scope)', async () => {
      // Mock hasEffective checks to pass
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });
      prismaMock.userPermissionOverride.findUnique.mockResolvedValue({ effect: 'grant', scope: DataScope.team });

      const scope = await service.scopeFor(orgId, principal, 'tasks.task.manage', PermissionAction.read);
      expect(scope).toBe(DataScope.team);
    });
  });

  describe('isEligibleSubject', () => {
    const orgId = 'org-1';
    const userId = 'user-2';

    it('should block if the module is disabled for the organization', async () => {
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.off });

      const eligibility = await service.isEligibleSubject(orgId, 'tasks.subject.assignable', userId);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain('not enabled');
    });

    it('should respect user-specific subject overrides', async () => {
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });
      prismaMock.userSubjectOverride.findUnique.mockResolvedValue({ effect: 'deny', reason: 'On probation' });

      const eligibility = await service.isEligibleSubject(orgId, 'tasks.subject.assignable', userId);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('On probation');
    });

    it('should default to policy default if no override exists', async () => {
      prismaMock.orgModuleEntitlement.findUnique.mockResolvedValue({ state: EntitlementState.full });
      prismaMock.userSubjectOverride.findUnique.mockResolvedValue(null);
      prismaMock.subjectEligibilityPolicy.findUnique.mockResolvedValue({ default_eligible: true });

      const eligibility = await service.isEligibleSubject(orgId, 'tasks.assign', userId);
      expect(eligibility.eligible).toBe(true);
    });
  });
});
