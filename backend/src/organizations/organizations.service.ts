import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgWithAdminDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
      include: {
        _count: { select: { members: true, departments: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true, departments: true } },
        org_identity: true,
        group: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, is_active: true } } },
          orderBy: { joined_at: 'asc' },
        },
      },
    });

    if (!org) throw new NotFoundException(`Organization with id ${id} not found`);

    // Enrich members with their other org memberships (also_in)
    const enrichedMembers = await Promise.all(
      org.members.map(async (m) => {
        const otherMemberships = await this.prisma.organizationMember.findMany({
          where: { user_id: m.user_id, organization_id: { not: id }, is_active: true },
          include: { organization: { select: { id: true, name: true } } },
        });
        return { ...m, also_in: otherMemberships.map((om) => om.organization) };
      }),
    );

    return { ...org, members: enrichedMembers };
  }

  /**
   * Lightweight, member-safe view of a single org. Unlike findOne (super-admin
   * only, returns the full member roster + cross-org memberships), this returns
   * just the public-facing org profile so any member can render their own
   * dashboard header. Scope is enforced by OrgScopeGuard at the controller.
   */
  async findSummary(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        logo_url: true,
        industry: true,
        country: true,
        timezone: true,
        status: true,
        group: { select: { id: true, name: true } },
      },
    });

    if (!org) throw new NotFoundException(`Organization with id ${id} not found`);

    return org;
  }

  async create(dto: CreateOrgWithAdminDto) {
    const { admin_name, admin_email, admin_password, existing_user_id, ...orgData } = dto;

    if (!existing_user_id && !admin_email) {
      throw new UnprocessableEntityException('Either existing_user_id or admin_email is required');
    }

    const existingOrg = await this.prisma.organization.findUnique({ where: { slug: orgData.slug } });
    if (existingOrg) throw new ConflictException(`Slug '${orgData.slug}' is already taken`);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { ...orgData, status: 'active' as any },
      });

      let adminUser: { id: string; name: string; email: string; is_active: boolean; created_at: Date };

      if (existing_user_id) {
        // Path A: pick an existing user directly by ID
        const found = await tx.user.findUnique({
          where: { id: existing_user_id },
          select: { id: true, name: true, email: true, is_active: true, created_at: true },
        });
        if (!found) throw new NotFoundException(`User ${existing_user_id} not found`);
        adminUser = found;
      } else {
        // Path B: find or create by email
        const found = await tx.user.findUnique({ where: { email: admin_email! } });
        if (found) {
          adminUser = found;
        } else {
          if (!admin_password) {
            throw new BadRequestException('admin_password is required when the email does not belong to an existing user');
          }
          const password_hash = await bcrypt.hash(admin_password, 12);
          adminUser = await tx.user.create({
            data: { name: admin_name!, email: admin_email!, password_hash, is_active: true },
            select: { id: true, name: true, email: true, is_active: true, created_at: true },
          });
        }
      }

      const member = await tx.organizationMember.create({
        data: { organization_id: organization.id, user_id: adminUser.id, role: 'org_admin', is_active: true },
      });

      return {
        organization,
        admin: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: member.role,
          organization_id: organization.id,
          is_active: adminUser.is_active,
          created_at: adminUser.created_at,
        },
      };
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);

    return this.prisma.organization.update({
      where: { id },
      data: dto as any,
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);

    return this.prisma.organization.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }
}
