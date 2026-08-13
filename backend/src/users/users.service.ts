import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePhoneForSave } from '../common/identifier.util';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  country_code: true,
  phone: true,
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

  // Returns members in the format the task assignee picker expects — open to all roles
  async findMembers(orgId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organization_id: orgId, is_active: true },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joined_at: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      is_admin: m.is_admin,
      user: { id: m.user.id, name: m.user.name, email: m.user.email },
    }));
  }

  async findOne(id: string, orgId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { user_id: id, organization_id: orgId },
      include: { user: { select: USER_SELECT } },
    });
    if (!member) throw new NotFoundException(`User with id ${id} not found in this organization`);
    return this.toUserDto(member, orgId);
  }

  async update(id: string, orgId: string, dto: UpdateUserDto) {
    await this.findOne(id, orgId);

    // Pull phone identity out so it never gets written raw — it must go through the
    // shared normalise + validate + collision path below. (email is left as-is here;
    // changing email is a separate concern and out of scope for this change.)
    const { password, is_admin, phone, country_code, ...rest } = dto;
    const userUpdateData: Record<string, unknown> = { ...rest };
    if (password) {
      userUpdateData.password_hash = await bcrypt.hash(password, 12);
    }

    // Only touch the phone when the caller actually sent a phone/country field.
    // Both are stored together or both cleared together (resolvePhoneForSave
    // enforces this and validates the digit length for the chosen country, using
    // the SAME helper as create + login — no second copy of that logic).
    if (phone !== undefined || country_code !== undefined) {
      const resolved = resolvePhoneForSave(country_code, phone);
      if (resolved.phone) {
        // Reject if this exact (country_code, phone) already belongs to someone else.
        // Never silently overwrite, never create a second account.
        const clash = await this.prisma.user.findUnique({
          where: { country_code_phone: { country_code: resolved.country_code!, phone: resolved.phone } },
          select: { id: true },
        });
        if (clash && clash.id !== id) {
          throw new ConflictException('This number is already used by another account.');
        }
      }
      userUpdateData.country_code = resolved.country_code; // string or null (cleared)
      userUpdateData.phone = resolved.phone; // string or null (cleared)
    }

    await this.prisma.user.update({ where: { id }, data: userUpdateData });

    if (is_admin !== undefined) {
      await this.prisma.organizationMember.updateMany({
        where: { user_id: id, organization_id: orgId },
        data: { is_admin },
      });
    }

    return this.findOne(id, orgId);
  }

  async deactivate(id: string, orgId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { user_id: id, organization_id: orgId },
    });
    if (!member) throw new NotFoundException(`User not found in this organization`);

    // Prevent deactivating the primary administrator of the organization
    const primaryAdmin = await this.prisma.organizationMember.findFirst({
      where: { organization_id: orgId, is_admin: true },
      orderBy: { joined_at: 'asc' },
    });
    if (primaryAdmin && id === primaryAdmin.user_id) {
      throw new BadRequestException(
        'The primary administrator of this organization cannot be deactivated.',
      );
    }

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
      country_code: member.user.country_code,
      phone: member.user.phone,
      is_admin: member.is_admin,
      is_active: member.is_active && member.user.is_active,
      organization_id: orgId,
      created_at: member.user.created_at,
      updated_at: member.user.updated_at,
    };
  }
}
