import { PermissionAdminService } from './permission-admin.service';

describe('PermissionAdminService entitlement registry', () => {
  const prisma = {
    orgModuleEntitlement: { findMany: jest.fn() },
  } as any;
  const service = new PermissionAdminService(prisma, {} as any, {} as any);

  beforeEach(() => jest.clearAllMocks());

  it('omits off modules and limits preview modules to read actions', async () => {
    prisma.orgModuleEntitlement.findMany.mockResolvedValue([
      { module_key: 'tasks', state: 'full' },
      { module_key: 'tickets', state: 'off' },
      { module_key: 'projects', state: 'preview' },
    ]);

    const result = await service.getRegistry('org-1');
    const keys = result.modules.map((module) => module.key);

    expect(keys).toContain('tasks');
    expect(keys).not.toContain('tickets');
    expect(keys).not.toContain('workflows');

    const projects = result.modules.find((module) => module.key === 'projects');
    expect(projects?.entitlementState).toBe('preview');
    expect(projects?.subModules[0].features[0].actions).toEqual(['read']);
  });
});
