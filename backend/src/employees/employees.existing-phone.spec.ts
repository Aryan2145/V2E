/**
 * Audit issue #5: when an admin adds a person who ALREADY has a V2E login and types
 * a (different) phone number, that number used to be silently dropped. It must now
 * stop with a clear message telling the admin it was not applied.
 */
import { ConflictException } from '@nestjs/common';
import { EmployeesService } from './employees.service';

function makeService(existing: any) {
  const tx: any = {
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.email !== undefined) return Promise.resolve(where.email === existing.email ? existing : null);
        if (where.country_code_phone) return Promise.resolve(null); // the typed number belongs to nobody
        return Promise.resolve(null);
      }),
      create: jest.fn(),
    },
    employeeProfile: { findFirst: jest.fn(() => Promise.resolve(null)) },
    organizationMember: { findFirst: jest.fn(() => Promise.resolve(null)) },
  };
  const prisma: any = {
    role: { findFirst: jest.fn(() => Promise.resolve({ id: 'role-1' })) },
    department: { findFirst: jest.fn(() => Promise.resolve({ id: 'dept-1' })) },
    systemRole: { findFirst: jest.fn(() => Promise.resolve({ id: 'sr-1' })) },
    $transaction: jest.fn((cb: any) => cb(tx)),
  };
  const svc = new EmployeesService(prisma, {} as any, {} as any, {} as any);
  return { svc, tx };
}

describe('add existing person + typed phone (issue #5)', () => {
  const EXISTING = { id: 'u1', name: 'Bob', email: 'bob@acme.com', country_code: '+91', phone: '1111111111' };

  const dtoWithPhone = {
    name: 'Bob',
    email: 'bob@acme.com',
    phone: '9876543210', // a DIFFERENT number than Bob already has
    country_code: '+91',
    role_id: 'role-1',
    system_role_id: 'sr-1',
    department_id: 'dept-1',
  };

  it('is reported, not silently ignored, and the account is not touched', async () => {
    const { svc, tx } = makeService(EXISTING);
    await expect(svc.create('org-1', dtoWithPhone as any)).rejects.toThrow(/was NOT applied/i);
    // We never created or overwrote a user.
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('still allows adding the existing person when no phone is typed', async () => {
    const { svc } = makeService(EXISTING);
    const dtoNoPhone = { ...dtoWithPhone, phone: undefined, country_code: undefined };
    // Gets past the identity guard (it will proceed to create membership+profile,
    // which our light tx mock doesn't fully implement — so we only assert it does
    // NOT throw the issue-#5 conflict).
    await expect(svc.create('org-1', dtoNoPhone as any)).rejects.not.toThrow(/was NOT applied/i);
  });
});
