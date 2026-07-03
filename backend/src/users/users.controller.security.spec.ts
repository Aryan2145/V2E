/**
 * Cross-organization isolation regression tests for the users write routes.
 *
 * These cover SECURITY_AUDIT.md findings C2, C3 and C6: the three mutating
 * routes on the users controller (PATCH /:id, POST /, DELETE /:id/deactivate)
 * were missing `OrgScopeGuard`. Because `@RequireAdmin` only proves the caller
 * is an admin of THEIR OWN org (and never binds them to the `:orgId` in the
 * URL), an admin of organization A could reach into organization B and reset a
 * password, mint an admin, or deactivate a member. Only `OrgScopeGuard` ties
 * the caller's org to the path org — so its absence was the whole hole.
 *
 * The test stands up the REAL guard stack (`RolesGuard` + `OrgScopeGuard`)
 * around the real controller. Only the JWT layer is faked: `JwtAuthGuard` is
 * overridden to inject `request.user` with the exact shape the real
 * `JwtStrategy.validate()` returns. Nothing about the org check itself is
 * mocked, so a pass here is genuine proof.
 *
 * Each finding has two cases:
 *   1. an org-A admin acting on an org-B target is BLOCKED (403) and the
 *      service is never called — this is the case that FAILS on the unpatched
 *      controller (the request would reach the service and succeed);
 *   2. an org-A admin acting on a target in their OWN org still WORKS — proving
 *      the fix does not break the legitimate feature (e.g. promoting one of
 *      your own members to admin).
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

// The caller the overridden JwtAuthGuard injects as request.user for each test.
// Shape mirrors JwtStrategy.validate() — the guards only read isSuperAdmin,
// is_admin and organizationId.
let currentUser: Record<string, unknown>;

// A genuine platform admin of organization A — the attacker in the cross-org
// cases, the legitimate actor in the same-org cases.
const ADMIN_OF_ORG_A = {
  id: 'admin-a',
  email: 'admin@org-a.example',
  name: 'Admin A',
  isSuperAdmin: false,
  organizationId: 'org-A',
  is_admin: true,
};

describe('UsersController cross-org isolation (SECURITY_AUDIT C2/C3/C6)', () => {
  let app: INestApplication;

  const usersService = {
    update: jest.fn().mockResolvedValue({ id: 'victim', organization_id: 'org-B' }),
    create: jest.fn().mockResolvedValue({ id: 'new-user', organization_id: 'org-B' }),
    deactivate: jest.fn().mockResolvedValue({ id: 'victim', is_active: false }),
  };

  // OrgScopeGuard depends on PrismaService. For the `users` path segment there
  // is no entitlement module, so the guard never actually queries — but the DI
  // container still needs the provider to construct the guard.
  const prisma = { orgModuleEntitlement: { findUnique: jest.fn() } };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      // Fake ONLY authentication: put our caller on the request and let the real
      // RolesGuard + OrgScopeGuard run exactly as they do in production.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { ...ADMIN_OF_ORG_A };
  });

  // ── C2 — PATCH /org/:orgId/users/:id (account takeover) ──────────────────
  describe('C2 — PATCH /org/:orgId/users/:id', () => {
    it('BLOCKS an org-A admin from updating a user in org-B (403, service untouched)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/org/org-B/users/victim-in-b')
        .send({ password: 'attacker-chosen', is_admin: true })
        .expect(403);

      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('ALLOWS an org-A admin to promote a member of their OWN org', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/org/org-A/users/member-in-a')
        .send({ is_admin: true })
        .expect(200);

      expect(usersService.update).toHaveBeenCalledWith('member-in-a', 'org-A', {
        is_admin: true,
      });
    });
  });

  // ── C3 — POST /org/:orgId/users (mint an admin) ──────────────────────────
  describe('C3 — POST /org/:orgId/users', () => {
    it('BLOCKS an org-A admin from creating a user in org-B (403, service untouched)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/org/org-B/users')
        .send({ name: 'Planted', email: 'planted@org-b.example', password: 'x', is_admin: true })
        .expect(403);

      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('ALLOWS an org-A admin to create a user in their OWN org', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/org/org-A/users')
        .send({ name: 'New Hire', email: 'new@org-a.example', password: 'x' })
        .expect(201);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@org-a.example', organization_id: 'org-A' }),
      );
    });
  });

  // ── C6 — DELETE /org/:orgId/users/:id/deactivate (cross-org lockout) ─────
  describe('C6 — DELETE /org/:orgId/users/:id/deactivate', () => {
    it('BLOCKS an org-A admin from deactivating a user in org-B (403, service untouched)', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/org/org-B/users/victim-in-b/deactivate')
        .expect(403);

      expect(usersService.deactivate).not.toHaveBeenCalled();
    });

    it('ALLOWS an org-A admin to deactivate a member of their OWN org', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/org/org-A/users/member-in-a/deactivate')
        .expect(200);

      expect(usersService.deactivate).toHaveBeenCalledWith('member-in-a', 'org-A');
    });
  });
});
