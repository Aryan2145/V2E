import {
  ConflictException,
  Injectable,
  NotFoundException,
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
        _count: {
          select: {
            members: true,
            departments: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            departments: true,
          },
        },
        org_identity: true,
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }

    return org;
  }

  async create(dto: CreateOrgWithAdminDto) {
    const { admin_name, admin_email, admin_password, ...orgData } = dto;

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: orgData.slug },
    });

    if (existingOrg) {
      throw new ConflictException(`Slug '${orgData.slug}' is already taken`);
    }

    const password_hash = await bcrypt.hash(admin_password, 12);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { ...orgData, status: 'active' as any },
      });

      let adminUser = await tx.user.findUnique({ where: { email: admin_email } });

      if (!adminUser) {
        adminUser = await tx.user.create({
          data: { name: admin_name, email: admin_email, password_hash, is_active: true },
        });
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
