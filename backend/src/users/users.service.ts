import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  organization_id: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.user.findMany({
      where: { organization_id: orgId },
      select: SAFE_USER_SELECT,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organization_id: orgId },
      select: SAFE_USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(
        `User with id ${id} not found in this organization`,
      );
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    const { password, ...rest } = dto;

    const existingUser = await this.prisma.user.findFirst({
      where: { email: rest.email, organization_id: rest.organization_id ?? null },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email '${rest.email}' already exists`,
      );
    }

    const password_hash = await bcrypt.hash(password, 12);

    return this.prisma.user.create({
      data: {
        name: rest.name,
        email: rest.email,
        password_hash,
        role: rest.role as any,
        organization_id: rest.organization_id ?? null,
        is_active: true,
      } as any,
      select: SAFE_USER_SELECT,
    });
  }

  async update(id: string, orgId: string, dto: UpdateUserDto) {
    await this.findOne(id, orgId);

    const { password, ...rest } = dto;
    const updateData: Record<string, unknown> = { ...rest };

    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 12);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: SAFE_USER_SELECT,
    });
  }

  async deactivate(id: string, orgId: string) {
    await this.findOne(id, orgId);

    return this.prisma.user.update({
      where: { id },
      data: { is_active: false },
      select: SAFE_USER_SELECT,
    });
  }
}
