import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.department.findMany({
      where: { organization_id: orgId },
      include: {
        head_user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            child_departments: true,
            roles: true,
            employee_profiles: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, organization_id: orgId },
      include: {
        head_user: {
          select: { id: true, name: true, email: true },
        },
        parent_department: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            child_departments: true,
            roles: true,
            employee_profiles: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department ${id} not found in this organization`);
    }

    return department;
  }

  async create(orgId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        ...dto,
        organization_id: orgId,
      },
      include: {
        head_user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(id: string, orgId: string, dto: UpdateDepartmentDto) {
    await this.findOne(id, orgId);

    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: {
        head_user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async updatePosition(id: string, orgId: string, x: number, y: number) {
    await this.findOne(id, orgId);

    return this.prisma.department.update({
      where: { id },
      data: { position_x: x, position_y: y },
      select: {
        id: true,
        position_x: true,
        position_y: true,
        updated_at: true,
      },
    });
  }

  async remove(id: string, orgId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, organization_id: orgId },
      include: {
        _count: {
          select: {
            child_departments: true,
            employee_profiles: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department ${id} not found in this organization`);
    }

    if (department._count.child_departments > 0) {
      throw new BadRequestException(
        'Cannot delete department that has child departments. Reassign or delete children first.',
      );
    }

    if (department._count.employee_profiles > 0) {
      throw new BadRequestException(
        'Cannot delete department that has employees. Reassign employees first.',
      );
    }

    await this.prisma.department.delete({ where: { id } });

    return { message: 'Department deleted successfully' };
  }
}
