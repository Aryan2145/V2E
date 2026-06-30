import { WorkflowEngineService } from './workflow-engine.service';

describe('WorkflowEngineService entitlement ceiling', () => {
  const prisma = {
    orgModuleEntitlement: { findUnique: jest.fn() },
  } as any;
  const auditWriter = { runAsSystem: jest.fn() } as any;
  const service = new WorkflowEngineService(prisma, {} as any, {} as any, auditWriter);

  beforeEach(() => jest.clearAllMocks());

  it.each(['off', 'preview'])('does not run automation when workflows are %s', async (state) => {
    prisma.orgModuleEntitlement.findUnique.mockResolvedValue({ state });

    await service.processDateTriggersForOrg('org-1', new Date());
    await service.processOverdueStepsForOrg('org-1', new Date());

    expect(auditWriter.runAsSystem).not.toHaveBeenCalled();
  });
});
