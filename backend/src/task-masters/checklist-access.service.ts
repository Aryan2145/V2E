import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { descendantIds, DeptNode } from '../holidays/dept-tree.util';

/**
 * Resolves WHO may use a checklist template when creating a task.
 *
 * A template is accessible to a user when its `access_mode` is `everyone`, or
 * (when `restricted`) the user matches ANY access rule — by department (with
 * optional sub-department cascade), by dept-scoped role, or as an explicit user.
 * Rules are a UNION: department OR role OR person.
 */
@Injectable()
export class ChecklistAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The user's department + role within an org, or null if they have no profile. */
  private async getUserDeptRole(orgId: string, userId: string): Promise<{ departmentId: string | null; roleId: string | null }> {
    const profile = await this.prisma.employeeProfile.findFirst({
      where: { organization_id: orgId, user_id: userId },
      select: { department_id: true, role_id: true },
    });
    return { departmentId: profile?.department_id ?? null, roleId: profile?.role_id ?? null };
  }

  private async getDeptNodes(orgId: string): Promise<DeptNode[]> {
    return this.prisma.department.findMany({
      where: { organization_id: orgId },
      select: { id: true, parent_department_id: true },
    });
  }

  /** Does any rule match this user? `deptNodes` is passed in so callers can reuse it. */
  private matchesAnyRule(
    rules: { kind: string; department_id: string | null; include_sub_departments: boolean; role_id: string | null; user_id: string | null }[],
    userId: string,
    departmentId: string | null,
    roleId: string | null,
    deptNodes: DeptNode[],
  ): boolean {
    // An explicit exclusion always wins over any grant (dynamic dept/role or direct).
    if (rules.some((r) => r.kind === 'exclude_user' && r.user_id === userId)) return false;
    if (rules.some((r) => r.kind === 'exclude_role' && !!roleId && r.role_id === roleId)) return false;
    return rules.some((r) => {
      if (r.kind === 'user') return r.user_id === userId;
      if (r.kind === 'role') return !!roleId && r.role_id === roleId;
      if (r.kind === 'department') {
        if (!departmentId || !r.department_id) return false;
        if (departmentId === r.department_id) return true;
        return r.include_sub_departments && descendantIds(deptNodes, r.department_id).has(departmentId);
      }
      return false;
    });
  }

  /** Templates the user may pick when creating a task. */
  async listAccessibleTemplates(orgId: string, userId: string) {
    const templates = await this.prisma.taskChecklistTemplate.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'asc' },
      include: { access_rules: true },
    });
    const restricted = templates.filter((t) => t.access_mode === 'restricted');
    if (restricted.length === 0) return templates; // all `everyone`

    const { departmentId, roleId } = await this.getUserDeptRole(orgId, userId);
    const deptNodes = await this.getDeptNodes(orgId);
    return templates.filter((t) => {
      if (t.access_mode === 'everyone') return true;
      return this.matchesAnyRule(t.access_rules, userId, departmentId, roleId, deptNodes);
    });
  }

  /** Whether a single template is usable by the user (enforcement gate). */
  async isAccessible(orgId: string, userId: string, templateId: string): Promise<boolean> {
    const template = await this.prisma.taskChecklistTemplate.findFirst({
      where: { id: templateId, organization_id: orgId },
      include: { access_rules: true },
    });
    if (!template) return false;
    if (template.access_mode === 'everyone') return true;

    const { departmentId, roleId } = await this.getUserDeptRole(orgId, userId);
    const deptNodes = await this.getDeptNodes(orgId);
    return this.matchesAnyRule(template.access_rules, userId, departmentId, roleId, deptNodes);
  }
}
