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
            users: true,
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
            users: true,
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

    const existingUser = await this.prisma.user.findFirst({
      where: { email: admin_email, organization_id: null },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email '${admin_email}' already exists`,
      );
    }

    const password_hash = await bcrypt.hash(admin_password, 12);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          ...orgData,
          status: 'active' as any,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          name: admin_name,
          email: admin_email,
          password_hash,
          role: 'org_admin',
          organization_id: organization.id,
          is_active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organization_id: true,
          is_active: true,
          created_at: true,
        },
      });

      return { organization, admin: adminUser };
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
