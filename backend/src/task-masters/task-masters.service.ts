import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';

@Injectable()
export class TaskMastersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Config ─────────────────────────────────────────────────────────────────

  async getOrCreateConfig(orgId: string) {
    const config = await this.prisma.taskMaster.upsert({
      where: { organization_id: orgId },
      create: { organization_id: orgId },
      update: {},
    });

    // Seed default priorities if none exist
    const priorityCount = await this.prisma.taskPriority.count({ where: { organization_id: orgId } });
    if (priorityCount === 0) {
      await this.prisma.taskPriority.createMany({
        data: [
          { organization_id: orgId, label: 'Critical', color: '#DC2626', order_index: 0 },
          { organization_id: orgId, label: 'High', color: '#EA580C', order_index: 1 },
          { organization_id: orgId, label: 'Medium', color: '#D97706', order_index: 2 },
          { organization_id: orgId, label: 'Low', color: '#2563EB', order_index: 3 },
        ],
      });
    }

    // Seed default statuses if none exist
    const statusCount = await this.prisma.taskStatus.count({ where: { organization_id: orgId } });
    if (statusCount === 0) {
      await this.prisma.taskStatus.createMany({
        data: [
          { organization_id: orgId, label: 'To Do', type: 'todo', color: '#6B7280', order_index: 0, is_default: true },
          { organization_id: orgId, label: 'In Progress', type: 'in_progress', color: '#2563EB', order_index: 1 },
          { organization_id: orgId, label: 'Done', type: 'completed', color: '#16A34A', order_index: 2 },
        ],
      });
    }

    return config;
  }

  async updateConfig(orgId: string, dto: UpdateConfigDto) {
    await this.getOrCreateConfig(orgId);
    return this.prisma.taskMaster.update({
      where: { organization_id: orgId },
      data: {
        ...(dto.task_creation_roles !== undefined && { task_creation_roles: dto.task_creation_roles }),
        ...(dto.task_edit_roles !== undefined && { task_edit_roles: dto.task_edit_roles }),
        ...(dto.task_delete_roles !== undefined && { task_delete_roles: dto.task_delete_roles }),
        ...(dto.default_reminder_days_before !== undefined && { default_reminder_days_before: dto.default_reminder_days_before }),
        ...(dto.default_reminder_frequency !== undefined && { default_reminder_frequency: dto.default_reminder_frequency }),
        ...(dto.reopen_window_minutes !== undefined && { reopen_window_minutes: dto.reopen_window_minutes }),
        ...(dto.escalation_levels !== undefined && { escalation_levels: dto.escalation_levels }),
        ...(dto.archive_view_roles !== undefined && { archive_view_roles: dto.archive_view_roles }),
      },
    });
  }

  // ─── Categories ─────────────────────────────────────────────────────────────

  async listCategories(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
    });

    const allCategories = await this.prisma.taskCategory.findMany({
      where: { organization_id: orgId, is_active: true },
      orderBy: { created_at: 'asc' },
    });

    if (!member) return allCategories;

    // Look up department via EmployeeProfile (which has department_id)
    const employeeProfile = await this.prisma.employeeProfile.findFirst({
      where: { user_id: userId, organization_id: orgId },
      select: { department_id: true },
    });

    return allCategories.filter((cat) => {
      const depts = cat.visible_to_departments as string[];
      const roles = cat.visible_to_roles as string[];
      const deptRestricted = Array.isArray(depts) && depts.length > 0;
      const roleRestricted = Array.isArray(roles) && roles.length > 0;
      if (!deptRestricted && !roleRestricted) return true;
      if (deptRestricted && employeeProfile?.department_id && depts.includes(employeeProfile.department_id)) return true;
      if (roleRestricted && roles.includes(member.role)) return true;
      return false;
    });
  }

  async createCategory(orgId: string, userId: string, dto: CreateCategoryDto) {
    return this.prisma.taskCategory.create({
      data: {
        organization_id: orgId,
        created_by_user_id: userId,
        name: dto.name,
        description: dto.description,
        color: dto.color ?? '#2563EB',
        visible_to_departments: dto.visible_to_departments ?? [],
        visible_to_roles: dto.visible_to_roles ?? [],
        is_active: dto.is_active ?? true,
      },
    });
  }

  async updateCategory(orgId: string, categoryId: string, dto: Partial<CreateCategoryDto>) {
    await this.findCategoryOrFail(orgId, categoryId);
    return this.prisma.taskCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.visible_to_departments !== undefined && { visible_to_departments: dto.visible_to_departments }),
        ...(dto.visible_to_roles !== undefined && { visible_to_roles: dto.visible_to_roles }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });
  }

  async deactivateCategory(orgId: string, categoryId: string) {
    await this.findCategoryOrFail(orgId, categoryId);
    return this.prisma.taskCategory.update({
      where: { id: categoryId },
      data: { is_active: false },
    });
  }

  private async findCategoryOrFail(orgId: string, categoryId: string) {
    const cat = await this.prisma.taskCategory.findFirst({ where: { id: categoryId, organization_id: orgId } });
    if (!cat) throw new NotFoundException(`Category ${categoryId} not found`);
    return cat;
  }

  // ─── Priorities ─────────────────────────────────────────────────────────────

  async listPriorities(orgId: string) {
    return this.prisma.taskPriority.findMany({
      where: { organization_id: orgId, is_active: true },
      orderBy: { order_index: 'asc' },
    });
  }

  async createPriority(orgId: string, dto: CreatePriorityDto) {
    return this.prisma.taskPriority.create({
      data: {
        organization_id: orgId,
        label: dto.label,
        color: dto.color ?? '#2563EB',
        order_index: dto.order_index ?? 0,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async updatePriority(orgId: string, priorityId: string, dto: Partial<CreatePriorityDto>) {
    await this.findPriorityOrFail(orgId, priorityId);
    return this.prisma.taskPriority.update({
      where: { id: priorityId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.order_index !== undefined && { order_index: dto.order_index }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });
  }

  private async findPriorityOrFail(orgId: string, priorityId: string) {
    const p = await this.prisma.taskPriority.findFirst({ where: { id: priorityId, organization_id: orgId } });
    if (!p) throw new NotFoundException(`Priority ${priorityId} not found`);
    return p;
  }

  // ─── Statuses ────────────────────────────────────────────────────────────────

  async listStatuses(orgId: string) {
    return this.prisma.taskStatus.findMany({
      where: { organization_id: orgId, is_active: true },
      orderBy: { order_index: 'asc' },
    });
  }

  async createStatus(orgId: string, dto: CreateStatusDto) {
    return this.prisma.taskStatus.create({
      data: {
        organization_id: orgId,
        label: dto.label,
        type: dto.type,
        color: dto.color ?? '#2563EB',
        order_index: dto.order_index ?? 0,
        is_default: dto.is_default ?? false,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async updateStatus(orgId: string, statusId: string, dto: Partial<CreateStatusDto>) {
    await this.findStatusOrFail(orgId, statusId);
    return this.prisma.taskStatus.update({
      where: { id: statusId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.order_index !== undefined && { order_index: dto.order_index }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });
  }

  async getDefaultStatus(orgId: string) {
    const status = await this.prisma.taskStatus.findFirst({
      where: { organization_id: orgId, is_default: true, is_active: true },
      orderBy: { order_index: 'asc' },
    });
    if (!status) {
      // Fall back to first active status
      return this.prisma.taskStatus.findFirst({
        where: { organization_id: orgId, is_active: true },
        orderBy: { order_index: 'asc' },
      });
    }
    return status;
  }

  private async findStatusOrFail(orgId: string, statusId: string) {
    const s = await this.prisma.taskStatus.findFirst({ where: { id: statusId, organization_id: orgId } });
    if (!s) throw new NotFoundException(`Status ${statusId} not found`);
    return s;
  }

  // ─── Checklist Templates ─────────────────────────────────────────────────────

  async listChecklistTemplates(orgId: string) {
    return this.prisma.taskChecklistTemplate.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'asc' },
    });
  }

  async createChecklistTemplate(orgId: string, userId: string, dto: CreateChecklistTemplateDto) {
    return this.prisma.taskChecklistTemplate.create({
      data: {
        organization_id: orgId,
        created_by_user_id: userId,
        name: dto.name,
        items: (dto.items ?? []) as any,
      },
    });
  }

  async updateChecklistTemplate(orgId: string, templateId: string, dto: Partial<CreateChecklistTemplateDto>) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.taskChecklistTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.items !== undefined && { items: dto.items as any }),
      },
    });
  }

  async deleteChecklistTemplate(orgId: string, templateId: string) {
    await this.findTemplateOrFail(orgId, templateId);
    return this.prisma.taskChecklistTemplate.delete({ where: { id: templateId } });
  }

  private async findTemplateOrFail(orgId: string, templateId: string) {
    const t = await this.prisma.taskChecklistTemplate.findFirst({ where: { id: templateId, organization_id: orgId } });
    if (!t) throw new NotFoundException(`Checklist template ${templateId} not found`);
    return t;
  }
}
