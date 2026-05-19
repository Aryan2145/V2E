import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { user: { select: USER_SELECT } },
      orderBy: { joined_at: 'desc' },
    });
    return members.map((m) => this.toUserDto(m, orgId));
  }

  async findOne(id: string, orgId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { user_id: id, organization_id: orgId },
      include: { user: { select: USER_SELECT } },
    });
    if (!member) throw new NotFoundException(`User with id ${id} not found in this organization`);
    return this.toUserDto(member, orgId);
  }

  async create(dto: CreateUserDto) {
    const { password, organization_id, role, ...rest } = dto;

    let user = await this.prisma.user.findUnique({ where: { email: rest.email } });

    if (user) {
      const existingMember = await this.prisma.organizationMember.findFirst({
        where: { user_id: user.id, organization_id },
      });
      if (existingMember) {
        throw new ConflictException(`User is already a member of this organization`);
      }
    } else {
      const password_hash = await bcrypt.hash(password, 12);
      user = await this.prisma.user.create({
        data: { name: rest.name, email: rest.email, password_hash, is_active: true },
      });
    }

    const member = await this.prisma.organizationMember.create({
      data: { organization_id, user_id: user.id, role: (role ?? 'employee') as any },
      include: { user: { select: USER_SELECT } },
    });

    return this.toUserDto(member, organization_id);
  }

  async update(id: string, orgId: string, dto: UpdateUserDto) {
    await this.findOne(id, orgId);

    const { password, role, ...rest } = dto;
    const userUpdateData: Record<string, unknown> = { ...rest };
    if (password) {
      userUpdateData.password_hash = await bcrypt.hash(password, 12);
    }

    await this.prisma.user.update({ where: { id }, data: userUpdateData });

    if (role) {
      await this.prisma.organizationMember.updateMany({
        where: { user_id: id, organization_id: orgId },
        data: { role: role as any },
      });
    }

    return this.findOne(id, orgId);
  }

  async deactivate(id: string, orgId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { user_id: id, organization_id: orgId },
    });
    if (!member) throw new NotFoundException(`User not found in this organization`);

    await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { is_active: false },
    });

    return this.findOne(id, orgId);
  }

  private toUserDto(member: any, orgId: string) {
    return {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      is_active: member.is_active && member.user.is_active,
      organization_id: orgId,
      created_at: member.user.created_at,
      updated_at: member.user.updated_at,
    };
  }
}
