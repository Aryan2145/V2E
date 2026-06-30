import { ForbiddenException } from '@nestjs/common';
import { OrgScopeGuard } from './org-scope.guard';

const contextFor = (method: string, path: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        path,
        params: { orgId: 'org-1' },
        user: { organizationId: 'org-1' },
      }),
    }),
  }) as any;

describe('OrgScopeGuard workflow entitlements', () => {
  const prisma = {
    orgModuleEntitlement: { findUnique: jest.fn() },
  } as any;
  const guard = new OrgScopeGuard(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('blocks workflows when the entitlement is off', async () => {
    prisma.orgModuleEntitlement.findUnique.mockResolvedValue({ state: 'off' });

    await expect(
      guard.canActivate(contextFor('GET', '/api/v1/org/org-1/workflows')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows preview reads and blocks preview writes', async () => {
    prisma.orgModuleEntitlement.findUnique.mockResolvedValue({ state: 'preview' });

    await expect(
      guard.canActivate(contextFor('GET', '/api/v1/org/org-1/workflows')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor('POST', '/api/v1/org/org-1/workflows')),
    ).rejects.toThrow('preview mode');
  });
});
