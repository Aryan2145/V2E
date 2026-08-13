/**
 * Point 2: creating an organization with a phone-only admin (no email) is rejected,
 * because a firm's administrator must be recoverable by email.
 */
import { OrganizationsService } from './organizations.service';

function makeService() {
  // The guard fires before any DB work, so stubs are enough.
  const prisma: any = {};
  const mail: any = {};
  return new OrganizationsService(prisma, mail);
}

describe('create organization — admin must have an email', () => {
  it('rejects a phone-only admin', async () => {
    await expect(
      makeService().create({ name: 'Acme Sweets', admin_name: 'Asha', admin_phone: '9876543210', admin_country_code: '+91', admin_password: 'password123' } as any),
    ).rejects.toThrow(/must have an email/i);
  });

  it('rejects an admin with neither email nor phone', async () => {
    await expect(
      makeService().create({ name: 'Acme Sweets', admin_name: 'Asha', admin_password: 'password123' } as any),
    ).rejects.toThrow(/must have an email/i);
  });
});
