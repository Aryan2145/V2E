import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssigneeVisibilityService } from '../assignee-visibility/assignee-visibility.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assigneeVisibility: AssigneeVisibilityService,
  ) {}

  async findAll(orgId: string, departmentId?: string) {
    return this.prisma.role.findMany({
      where: {
        organization_id: orgId,
        ...(departmentId ? { department_id: departmentId } : {}),
      },
      include: {
        department: {
          select: { id: true, name: true },
        },
        _count: {
          select: { employee_profiles: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, organization_id: orgId },
      include: {
        department: {
          select: { id: true, name: true },
        },
        _count: {
          select: { employee_profiles: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found in this organization`);
    }

    return role;
  }

  async create(orgId: string, dto: CreateRoleDto) {
    const department = await this.prisma.department.findFirst({
      where: { id: dto.department_id, organization_id: orgId },
    });

    if (!department) {
      throw new NotFoundException(
        `Department ${dto.department_id} not found in this organization`,
      );
    }

    const created = await this.prisma.role.create({
      data: {
        ...dto,
        organization_id: orgId,
        kra: (dto.kra ?? []) as any,
        kpi: (dto.kpi ?? []) as any,
      } as any,
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });
    this.assigneeVisibility.invalidate(orgId);
    return created;
  }

  async update(id: string, orgId: string, dto: UpdateRoleDto) {
    await this.findOne(id, orgId);

    if (dto.department_id) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.department_id, organization_id: orgId },
      });

      if (!department) {
        throw new NotFoundException(
          `Department ${dto.department_id} not found in this organization`,
        );
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: dto as any,
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });
    // Role level / department changes affect bridge "senior" slices and excludes.
    this.assigneeVisibility.invalidate(orgId);
    return updated;
  }

  async remove(id: string, orgId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, organization_id: orgId },
      include: {
        _count: { select: { employee_profiles: true } },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found in this organization`);
    }

    if (role._count.employee_profiles > 0) {
      throw new BadRequestException(
        'Cannot delete role that has employees assigned. Reassign employees first.',
      );
    }

    await this.prisma.role.delete({ where: { id } });

    this.assigneeVisibility.invalidate(orgId);
    return { message: 'Role deleted successfully' };
  }
}
