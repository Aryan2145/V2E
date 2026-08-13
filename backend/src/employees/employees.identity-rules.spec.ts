/**
 * Employee create path: a person must have at least one login handle (point 1), and
 * a handle-only person cannot be given an admin System Role without an email (point 2).
 */
import { EmployeesService } from './employees.service';

function makeService(systemRoleIsAdmin = false) {
  const prisma: any = {
    role: { findFirst: jest.fn(() => Promise.resolve({ id: 'role-1' })) },
    department: { findFirst: jest.fn(() => Promise.resolve({ id: 'dept-1' })) },
    systemRole: { findFirst: jest.fn(() => Promise.resolve({ id: 'sr-1', is_admin: systemRoleIsAdmin })) },
    $transaction: jest.fn((cb: any) => cb({})),
  };
  return new EmployeesService(prisma, {} as any, {} as any, {} as any);
}

const base = { name: 'X', role_id: 'role-1', system_role_id: 'sr-1', department_id: 'dept-1' };

describe('employee create — identity rules', () => {
  it('rejects a person with neither email nor phone', async () => {
    await expect(makeService().create('org-1', { ...base } as any)).rejects.toThrow(/at least one is required/i);
  });

  it('rejects a phone-only person given an admin System Role', async () => {
    await expect(
      makeService(true).create('org-1', { ...base, phone: '9876543210', country_code: '+91' } as any),
    ).rejects.toThrow(/admin must always have an email/i);
  });

  it('allows a phone-only person with a NON-admin System Role (gets past the identity checks)', async () => {
    // Non-admin role + a valid phone → passes both identity guards. Our light tx stub
    // doesn't implement the rest, so we only assert it does NOT throw an identity error.
    const p = makeService(false).create('org-1', { ...base, phone: '9876543210', country_code: '+91' } as any);
    await expect(p).rejects.not.toThrow(/at least one is required|admin must always have an email/i);
  });
});
