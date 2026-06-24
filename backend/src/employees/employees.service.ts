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
import { AssigneeVisibilityService } from '../assignee-visibility/assignee-visibility.service';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  created_at: true,
};

const PROFILE_INCLUDE = {
  user: { select: USER_SELECT },
  role: { select: { id: true, title: true, level: true } },
  system_role: { select: { id: true, name: true, is_system: true } },
  department: { select: { id: true, name: true } },
  reporting_to: { select: USER_SELECT },
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
    private readonly assigneeVisibility: AssigneeVisibilityService,
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

    if (profileData.system_role_id) {
      const systemRoleExists = await this.prisma.systemRole.findFirst({
        where: { id: profileData.system_role_id, organization_id: orgId },
        select: { id: true },
      });
      if (!systemRoleExists) {
        throw new NotFoundException(
          `System role ${profileData.system_role_id} not found in this organization`,
        );
      }
    }

    // Employee codes must be unique within the organization.
    const code = profileData.employee_code?.trim();
    if (code) {
      const codeClash = await this.prisma.employeeProfile.findFirst({
        where: { organization_id: orgId, employee_code: code },
        select: { id: true },
      });
      if (codeClash) {
        throw new ConflictException(
          `Employee code '${code}' is already in use in this organization`,
        );
      }
    }

    const { profile, createdUserId } = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });

      if (user) {
        const existing = await tx.organizationMember.findFirst({
          where: { user_id: user.id, organization_id: orgId },
        });
        if (existing) {
          throw new ConflictException(
            `A user with email '${email}' already exists in this organization`,
          );
        }
      } else {
        const password_hash = await bcrypt.hash(password, 12);
        user = await tx.user.create({
          data: { name, email, password_hash, is_active: true },
        });
      }

      await tx.organizationMember.create({
        data: { organization_id: orgId, user_id: user.id, is_admin: false },
      });

      const profile = await tx.employeeProfile.create({
        data: {
          ...profileData,
          organization_id: orgId,
          user_id: user.id,
          date_of_joining: profileData.date_of_joining ? new Date(profileData.date_of_joining) : undefined,
          date_of_birth: profileData.date_of_birth ? new Date(profileData.date_of_birth) : undefined,
          marriage_date: profileData.marriage_date ? new Date(profileData.marriage_date) : undefined,
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

    this.assigneeVisibility.invalidate(orgId);
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

    if (dto.system_role_id) {
      const systemRoleExists = await this.prisma.systemRole.findFirst({
        where: { id: dto.system_role_id, organization_id: orgId },
        select: { id: true },
      });
      if (!systemRoleExists) {
        throw new NotFoundException(
          `System role ${dto.system_role_id} not found in this organization`,
        );
      }
    }

    const updated = await this.prisma.employeeProfile.update({
      where: { id },
      data: {
        ...dto,
        date_of_joining: dto.date_of_joining ? new Date(dto.date_of_joining) : undefined,
        date_of_birth: dto.date_of_birth ? new Date(dto.date_of_birth) : undefined,
        marriage_date: dto.marriage_date ? new Date(dto.marriage_date) : undefined,
      },
      include: PROFILE_INCLUDE,
    });
    // Role/department/manager changes affect who appears in pickers.
    this.assigneeVisibility.invalidate(orgId);
    return updated;
  }

  async updateStatus(id: string, orgId: string, status: EmployeeStatus) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { id, organization_id: orgId },
    });

    if (!profile) {
      throw new NotFoundException(`Employee ${id} not found in this organization`);
    }

    const updated = await this.prisma.employeeProfile.update({
      where: { id },
      data: { status },
      include: PROFILE_INCLUDE,
    });
    // Only active employees appear in pickers — status change affects the pool.
    this.assigneeVisibility.invalidate(orgId);
    return updated;
  }

  // ─── Self-service ────────────────────────────────────────────────────────────────

  /** The caller's own profile (resolved from their user id), with reporting chain. */
  async findMine(orgId: string, userId: string) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { organization_id: orgId, user_id: userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('You do not have an employee profile in this organization');
    }
    return this.findOne(profile.id, orgId);
  }

  /**
   * Self-edit of PERSONAL fields only. Org-structural fields (role, department,
   * manager, employment type, status) are intentionally not editable here.
   */
  async updateMine(
    orgId: string,
    userId: string,
    dto: { date_of_birth?: string | null; marriage_date?: string | null },
  ) {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { organization_id: orgId, user_id: userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('You do not have an employee profile in this organization');
    }
    const data: { date_of_birth?: Date | null; marriage_date?: Date | null } = {};
    if (dto.date_of_birth !== undefined) {
      data.date_of_birth = dto.date_of_birth ? new Date(dto.date_of_birth) : null;
    }
    if (dto.marriage_date !== undefined) {
      data.marriage_date = dto.marriage_date ? new Date(dto.marriage_date) : null;
    }
    return this.prisma.employeeProfile.update({
      where: { id: profile.id },
      data,
      include: PROFILE_INCLUDE,
    });
  }

  async getPeopleEvents(orgId: string, windowDays = 30) {
    const profiles = await this.prisma.employeeProfile.findMany({
      where: { organization_id: orgId, status: 'active' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    // Returns the next calendar occurrence of a month/day on or after today
    function nextOccurrence(month: number, day: number): Date {
      const thisYear = new Date(today.getFullYear(), month - 1, day);
      if (thisYear >= today) return thisYear;
      return new Date(today.getFullYear() + 1, month - 1, day);
    }

    function ordinal(n: number): string {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function formatDate(d: Date): string {
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }

    const birthdays: any[] = [];
    const anniversaries: any[] = [];
    const newHirings: any[] = [];
    const workAnniversaries: any[] = [];

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const p of profiles) {
      const base = {
        user_id: p.user_id,
        name: p.user.name,
        avatar_url: null,
      };

      // Birthdays
      if (p.date_of_birth) {
        const m = p.date_of_birth.getMonth() + 1;
        const d = p.date_of_birth.getDate();
        const next = nextOccurrence(m, d);
        if (next <= windowEnd) {
          const isToday = next.getTime() === today.getTime();
          birthdays.push({
            ...base,
            event_date: next.toISOString().split('T')[0],
            label: isToday ? 'Birthday Today' : `Birthday · ${formatDate(next)}`,
          });
        }
      }

      // Marriage anniversaries
      if (p.marriage_date) {
        const m = p.marriage_date.getMonth() + 1;
        const d = p.marriage_date.getDate();
        const next = nextOccurrence(m, d);
        if (next <= windowEnd) {
          const years = next.getFullYear() - p.marriage_date.getFullYear();
          const isToday = next.getTime() === today.getTime();
          anniversaries.push({
            ...base,
            event_date: next.toISOString().split('T')[0],
            label: isToday
              ? `${ordinal(years)} Anniversary Today`
              : `${ordinal(years)} Anniversary · ${formatDate(next)}`,
            years,
          });
        }
      }

      // New hirings — joined in the last 30 days (strictly less than 30 days ago)
      if (p.date_of_joining && p.date_of_joining > thirtyDaysAgo && p.date_of_joining <= today) {
        const diffDays = Math.floor((today.getTime() - p.date_of_joining.getTime()) / 86400000);
        newHirings.push({
          ...base,
          event_date: p.date_of_joining.toISOString().split('T')[0],
          label: diffDays === 0 ? 'Joined Today' : `Joined ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`,
        });
      }

      // Work anniversaries — anniversary of joining, at least 1 year
      if (p.date_of_joining) {
        const m = p.date_of_joining.getMonth() + 1;
        const d = p.date_of_joining.getDate();
        const next = nextOccurrence(m, d);
        const years = next.getFullYear() - p.date_of_joining.getFullYear();
        if (next <= windowEnd && years >= 1) {
          const isToday = next.getTime() === today.getTime();
          workAnniversaries.push({
            ...base,
            event_date: next.toISOString().split('T')[0],
            label: isToday
              ? `${ordinal(years)} Work Anniversary Today`
              : `${ordinal(years)} Work Anniversary · ${formatDate(next)}`,
            years,
          });
        }
      }
    }

    // Sort each list by event_date ascending
    const byDate = (a: any, b: any) => a.event_date.localeCompare(b.event_date);
    birthdays.sort(byDate);
    anniversaries.sort(byDate);
    workAnniversaries.sort(byDate);
    // New hirings: most recent first
    newHirings.sort((a, b) => b.event_date.localeCompare(a.event_date));

    return { birthdays, anniversaries, new_hirings: newHirings, work_anniversaries: workAnniversaries };
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
