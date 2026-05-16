import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { LearningService } from '../learning/learning.service';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  is_active: true,
  created_at: true,
};

const PROFILE_INCLUDE = {
  user: { select: USER_SELECT },
  role: { select: { id: true, title: true, level: true } },
  department: { select: { id: true, name: true } },
  reporting_to: { select: USER_SELECT },
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
  ) {}

  async findAll(orgId: string) {
    return this.prisma.employeeProfile.findMany({
      where: { organization_id: orgId },
      include: PROFILE_INCLUDE,
      orderBy: { created_at: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id, organization_id: orgId },
      include: PROFILE_INCLUDE,
    });

    if (!profile) {
      throw new NotFoundException(`Employee ${id} not found in this organization`);
    }

    // Build reporting chain up to 5 levels
    const reportingChain: typeof profile.reporting_to[] = [];
    let currentUserId = profile.reporting_to_user_id;
    let depth = 0;

    while (currentUserId && depth < 5) {
      const managerProfile = await this.prisma.employeeProfile.findFirst({
        where: { user_id: currentUserId, organization_id: orgId },
        include: {
          user: { select: USER_SELECT },
          role: { select: { id: true, title: true, level: true } },
          department: { select: { id: true, name: true } },
        },
      });

      if (!managerProfile) break;

      reportingChain.push(managerProfile.user as any);
      currentUserId = managerProfile.reporting_to_user_id ?? null;
      depth++;
    }

    return { ...profile, reporting_chain: reportingChain };
  }

  async create(orgId: string, dto: CreateEmployeeDto) {
    const { name, email, password, ...profileData } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email_organization_id: { email, organization_id: orgId } },
    });

    if (existingUser) {
      throw new ConflictException(
        `A user with email '${email}' already exists in this organization`,
      );
    }

    const roleExists = await this.prisma.role.findFirst({
      where: { id: profileData.role_id, organization_id: orgId },
    });

    if (!roleExists) {
      throw new NotFoundException(
        `Role ${profileData.role_id} not found in this organization`,
      );
    }

    const deptExists = await this.prisma.department.findFirst({
      where: { id: profileData.department_id, organization_id: orgId },
    });

    if (!deptExists) {
      throw new NotFoundException(
        `Department ${profileData.department_id} not found in this organization`,
      );
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { profile, createdUserId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password_hash,
          role: 'employee',
          organization_id: orgId,
          is_active: true,
        },
        select: USER_SELECT,
      });

      const profile = await tx.employeeProfile.create({
        data: {
          ...profileData,
          organization_id: orgId,
          user_id: user.id,
          date_of_joining: profileData.date_of_joining
            ? new Date(profileData.date_of_joining)
            : undefined,
        },
        include: PROFILE_INCLUDE,
      });

      return { profile, createdUserId: user.id };
    });

    // Auto-assign published learning paths after transaction commits
    await this.learningService.autoAssignForNewEmployee(
      profile.id,
      profileData.role_id,
      orgId,
      createdUserId,
    );

    return profile;
  }

  async update(id: string, orgId: string, dto: UpdateEmployeeDto) {
    await this.findOne(id, orgId);

    if (dto.role_id) {
      const roleExists = await this.prisma.role.findFirst({
        where: { id: dto.role_id, organization_id: orgId },
      });
      if (!roleExists) {
        throw new NotFoundException(
          `Role ${dto.role_id} not found in this organization`,
        );
      }
    }

    if (dto.department_id) {
      const deptExists = await this.prisma.department.findFirst({
        where: { id: dto.department_id, organization_id: orgId },
      });
      if (!deptExists) {
        throw new NotFoundException(
          `Department ${dto.department_id} not found in this organization`,
        );
      }
    }

    return this.prisma.employeeProfile.update({
      where: { id },
      data: {
        ...dto,
        date_of_joining: dto.date_of_joining
          ? new Date(dto.date_of_joining)
          : undefined,
      },
      include: PROFILE_INCLUDE,
    });
  }

  async updateStatus(id: string, orgId: string, status: EmployeeStatus) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id, organization_id: orgId },
    });

    if (!profile) {
      throw new NotFoundException(`Employee ${id} not found in this organization`);
    }

    return this.prisma.employeeProfile.update({
      where: { id },
      data: { status },
      include: PROFILE_INCLUDE,
    });
  }

  async getReportingTree(orgId: string) {
    const profiles = await this.prisma.employeeProfile.findMany({
      where: { organization_id: orgId },
      include: {
        user: { select: USER_SELECT },
        role: { select: { id: true, title: true, level: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return profiles.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      name: p.user.name,
      email: p.user.email,
      role: p.role,
      department: p.department,
      reporting_to_user_id: p.reporting_to_user_id,
      status: p.status,
      employment_type: p.employment_type,
      employee_code: p.employee_code,
    }));
  }
}
