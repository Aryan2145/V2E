import { ForbiddenException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EmploymentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LearningService } from '../learning/learning.service';
import { AssigneeVisibilityService } from '../assignee-visibility/assignee-visibility.service';
import {
  BulkImportRowDto,
  BulkImportResult,
  BulkImportRowResult,
  ImportBatchSummary,
  ImportResolved,
  ImportRowIssue,
  ImportValidationResult,
  ImportValidationRow,
  UndoImportResult,
  UndoKeptRow,
} from './dto/bulk-import-employee.dto';

const DEFAULT_IMPORT_PASSWORD = 'Welcome@123';
/** Combined dropdown values in the template read "Value · Context" with this glue. */
export const VALUE_SEPARATOR = ' · ';
const UNDO_WINDOW_MINUTES = 30;
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract'];
const MIN_AGE_YEARS = 15;
const MAX_AGE_YEARS = 100;

type ManagerRef = { kind: 'user'; id: string } | { kind: 'file'; email: string } | null;

interface Prepared {
  index: number;
  rowNum: number;
  name: string;
  email: string;
  password: string;
  dept?: { id: string; name: string };
  role?: { id: string; title: string };
  systemRole?: { id: string; name: string };
  employmentType: EmploymentType;
  employeeCode?: string;
  dateOfJoining?: Date;
  dateOfBirth?: Date;
  marriageDate?: Date;
  managerRef: ManagerRef;
  managerRaw?: string;
  managerLabel?: string;
  issues: ImportRowIssue[];
  isDuplicate: boolean;
}

interface ImportContext {
  deptByName: Map<string, { id: string; name: string }>;
  roles: { id: string; title: string; department_id: string }[];
  systemRoleByName: Map<string, { id: string; name: string }>;
  orgUserByEmail: Map<string, { id: string; name: string }>;
  orgUserByName: Map<string, string[]>;
  existingCodes: Set<string>;
  existingPeople: Set<string>; // `${nameLower}|${yyyy-mm-dd}`
}

@Injectable()
export class EmployeeImportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => LearningService))
    private readonly learningService: LearningService,
    private readonly assigneeVisibility: AssigneeVisibilityService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Dry-run: validate every row, resolve references, flag duplicates. Writes nothing. */
  async validateImport(orgId: string, rows: BulkImportRowDto[]): Promise<ImportValidationResult> {
    const ctx = await this.loadContext(orgId);
    const prepared = this.evaluate(rows, ctx);
    return this.toValidationResult(prepared);
  }

  /** Commit: re-validate (authoritative), write only the `ready` rows, record an import batch. */
  async commitImport(
    orgId: string,
    userId: string,
    rows: BulkImportRowDto[],
    fileName?: string,
  ): Promise<BulkImportResult> {
    const ctx = await this.loadContext(orgId);
    const prepared = this.evaluate(rows, ctx);

    const results: BulkImportRowResult[] = [];
    // Rows that won't import — surface them in the result with their first error.
    for (const p of prepared) {
      if (p.isDuplicate || p.issues.some((i) => i.severity === 'error')) {
        results.push({
          row: p.rowNum,
          name: p.name,
          email: p.email,
          status: 'failed',
          error: p.issues.find((i) => i.severity === 'error')?.message ?? 'Row could not be imported',
        });
      }
    }

    const ready = prepared.filter((p) => !p.isDuplicate && !p.issues.some((i) => i.severity === 'error'));
    if (ready.length === 0) {
      return { batch_id: null, created: 0, failed: results.length, results: this.sortResults(results) };
    }

    // Managers defined within the file must be created before their reports.
    const ordered = this.topoOrder(ready);

    const batch = await this.prisma.employeeImportBatch.create({
      data: {
        organization_id: orgId,
        imported_by_user_id: userId,
        file_name: fileName ?? null,
        total_rows: rows.length,
        created_count: 0,
        failed_count: 0,
      },
    });

    const createdUserByEmail = new Map<string, string>();
    let created = 0;

    for (const p of ordered) {
      try {
        // Resolve a manager that pointed at another file row, now that it exists.
        let reportingToUserId: string | undefined;
        if (p.managerRef?.kind === 'user') reportingToUserId = p.managerRef.id;
        else if (p.managerRef?.kind === 'file') {
          const id = createdUserByEmail.get(p.managerRef.email);
          if (!id) throw new Error(`Manager row (${p.managerRef.email}) was not imported`);
          reportingToUserId = id;
        }

        const userIdCreated = await this.prisma.$transaction(async (tx) => {
          let user = await tx.user.findUnique({ where: { email: p.email } });
          if (user) {
            const existing = await tx.organizationMember.findFirst({
              where: { user_id: user.id, organization_id: orgId },
            });
            if (existing) throw new Error('A user with this email already exists in this organization');
          } else {
            const password_hash = await bcrypt.hash(p.password, 12);
            user = await tx.user.create({ data: { name: p.name, email: p.email, password_hash, is_active: true } });
          }
          await tx.organizationMember.create({
            data: { organization_id: orgId, user_id: user.id, is_admin: false },
          });
          const profile = await tx.employeeProfile.create({
            data: {
              organization_id: orgId,
              user_id: user.id,
              role_id: p.role!.id,
              system_role_id: p.systemRole!.id,
              department_id: p.dept!.id,
              reporting_to_user_id: reportingToUserId,
              employee_code: p.employeeCode,
              employment_type: p.employmentType,
              date_of_joining: p.dateOfJoining,
              date_of_birth: p.dateOfBirth,
              marriage_date: p.marriageDate,
              import_batch_id: batch.id,
            },
          });
          // Auto-assign published learning paths (best-effort — never fail the row).
          try {
            await this.learningService.autoAssignForNewEmployee(profile.id, p.role!.id, orgId, user.id);
          } catch {
            /* non-critical */
          }
          return user.id;
        });

        createdUserByEmail.set(p.email, userIdCreated);
        results.push({ row: p.rowNum, name: p.name, email: p.email, status: 'created' });
        created++;
      } catch (e) {
        results.push({
          row: p.rowNum,
          name: p.name,
          email: p.email,
          status: 'failed',
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const failed = results.filter((r) => r.status === 'failed').length;
    await this.prisma.employeeImportBatch.update({
      where: { id: batch.id },
      data: { created_count: created, failed_count: failed },
    });

    if (created > 0) this.assigneeVisibility.invalidate(orgId);
    return { batch_id: batch.id, created, failed, results: this.sortResults(results) };
  }

  /** Import History — every batch, newest first, with how many rows still exist + undo eligibility. */
  async listImportBatches(orgId: string): Promise<ImportBatchSummary[]> {
    const batches = await this.prisma.employeeImportBatch.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
      include: {
        imported_by: { select: { name: true } },
        _count: { select: { profiles: true } },
      },
    });
    const cutoff = Date.now() - UNDO_WINDOW_MINUTES * 60_000;
    return batches.map((b) => ({
      id: b.id,
      file_name: b.file_name,
      imported_by: b.imported_by?.name ?? 'Unknown',
      total_rows: b.total_rows,
      created_count: b.created_count,
      failed_count: b.failed_count,
      remaining: b._count.profiles,
      status: b.status,
      can_undo: b.status === 'committed' && b._count.profiles > 0 && b.created_at.getTime() >= cutoff,
      created_at: b.created_at.toISOString(),
      undone_at: b.undone_at ? b.undone_at.toISOString() : null,
    }));
  }

  /**
   * Guarded undo: within the window, removes only rows that are still "clean" —
   * no one outside the batch reports to them, they don't head a department, and
   * they haven't accumulated activity (goals, meetings, messages). Anyone with
   * dependent data is kept and reported back with the reason.
   */
  async undoImport(orgId: string, batchId: string): Promise<UndoImportResult> {
    const batch = await this.prisma.employeeImportBatch.findFirst({
      where: { id: batchId, organization_id: orgId },
    });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status === 'undone') {
      return { batch_id: batchId, undone: 0, kept: [], status: 'undone' };
    }
    if (batch.created_at.getTime() < Date.now() - UNDO_WINDOW_MINUTES * 60_000) {
      throw new ForbiddenException(`Undo is only available within ${UNDO_WINDOW_MINUTES} minutes of import`);
    }

    const profiles = await this.prisma.employeeProfile.findMany({
      where: { import_batch_id: batchId, organization_id: orgId },
      select: {
        id: true,
        user_id: true,
        user: {
          select: {
            name: true,
            email: true,
            _count: {
              select: {
                headed_departments: true,
                owned_goals: true,
                organized_meetings: true,
                sent_messages: true,
                meeting_attendances: true,
              },
            },
            reports_to_employees: { select: { id: true, import_batch_id: true } },
          },
        },
      },
    });

    const keptReasons = new Map<string, string>(); // user_id -> reason
    const deletable = new Map<string, (typeof profiles)[number]>(); // user_id -> profile

    for (const p of profiles) {
      const c = p.user._count;
      const externalReports = p.user.reports_to_employees.filter((r) => r.import_batch_id !== batchId).length;
      const reasons: string[] = [];
      if (externalReports > 0) reasons.push(`${externalReports} person(s) outside this import now report to them`);
      if (c.headed_departments > 0) reasons.push('heads a department');
      if (c.owned_goals > 0) reasons.push('owns goals');
      if (c.organized_meetings > 0) reasons.push('organized meetings');
      if (c.sent_messages > 0) reasons.push('has sent messages');
      if (c.meeting_attendances > 0) reasons.push('is on meeting invites');
      if (reasons.length > 0) keptReasons.set(p.user_id, reasons.join('; '));
      else deletable.set(p.user_id, p);
    }

    // Fixpoint prune: never delete a manager that a RETAINED row still reports to —
    // that would dangle (or force us to alter) a kept employee's manager link.
    let changed = true;
    while (changed) {
      changed = false;
      const delProfileIdSet = new Set(Array.from(deletable.values()).map((p) => p.id));
      for (const [uid, p] of Array.from(deletable.entries())) {
        const pinnedBy = p.user.reports_to_employees.find((r) => !delProfileIdSet.has(r.id));
        if (pinnedBy) {
          deletable.delete(uid);
          keptReasons.set(uid, 'a retained employee reports to them');
          changed = true;
        }
      }
    }

    const kept: UndoKeptRow[] = profiles
      .filter((p) => keptReasons.has(p.user_id))
      .map((p) => ({ name: p.user.name, email: p.user.email, reason: keptReasons.get(p.user_id)! }));
    const delProfileIds = Array.from(deletable.values()).map((p) => p.id);
    const delUserIds = Array.from(deletable.keys());

    if (delProfileIds.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        // Remove import-origin learning footprint, then the profiles.
        const assignments = await tx.learningPathAssignment.findMany({
          where: { employee_profile_id: { in: delProfileIds } },
          select: { id: true },
        });
        const assignmentIds = assignments.map((a) => a.id);
        if (assignmentIds.length) {
          await tx.learningItemProgress.deleteMany({ where: { assignment_id: { in: assignmentIds } } });
          await tx.learningPathAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
        }
        await tx.companyPolicyAssignment.deleteMany({ where: { employee_profile_id: { in: delProfileIds } } });
        await tx.employeeProfile.deleteMany({ where: { id: { in: delProfileIds } } });
        await tx.organizationMember.deleteMany({
          where: { organization_id: orgId, user_id: { in: delUserIds } },
        });
        // Delete the user account only if it now belongs to no org and has no profiles.
        for (const uid of delUserIds) {
          const [mem, prof] = await Promise.all([
            tx.organizationMember.count({ where: { user_id: uid } }),
            tx.employeeProfile.count({ where: { user_id: uid } }),
          ]);
          if (mem === 0 && prof === 0) await tx.user.delete({ where: { id: uid } });
        }
      });
    }

    const remaining = await this.prisma.employeeProfile.count({ where: { import_batch_id: batchId } });
    const status = remaining === 0 ? 'undone' : 'partially_undone';
    await this.prisma.employeeImportBatch.update({
      where: { id: batchId },
      data: {
        status,
        undone_at: new Date(),
        undo_summary: { undone: delProfileIds.length, kept } as unknown as Prisma.InputJsonValue,
      },
    });

    if (delProfileIds.length > 0) this.assigneeVisibility.invalidate(orgId);
    return { batch_id: batchId, undone: delProfileIds.length, kept, status };
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async loadContext(orgId: string): Promise<ImportContext> {
    const [departments, roles, systemRoles, members, profiles] = await Promise.all([
      this.prisma.department.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } }),
      this.prisma.role.findMany({
        where: { organization_id: orgId },
        select: { id: true, title: true, department_id: true },
      }),
      this.prisma.systemRole.findMany({ where: { organization_id: orgId }, select: { id: true, name: true } }),
      this.prisma.organizationMember.findMany({
        where: { organization_id: orgId },
        select: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.employeeProfile.findMany({
        where: { organization_id: orgId },
        select: { employee_code: true, date_of_birth: true, user: { select: { name: true } } },
      }),
    ]);

    const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d]));
    const systemRoleByName = new Map(systemRoles.map((s) => [s.name.trim().toLowerCase(), s]));
    const orgUserByEmail = new Map<string, { id: string; name: string }>();
    const orgUserByName = new Map<string, string[]>();
    for (const m of members) {
      orgUserByEmail.set(m.user.email.toLowerCase(), { id: m.user.id, name: m.user.name });
      const k = m.user.name.trim().toLowerCase();
      orgUserByName.set(k, [...(orgUserByName.get(k) ?? []), m.user.id]);
    }
    const existingCodes = new Set(
      profiles.map((p) => p.employee_code?.trim().toLowerCase()).filter((v): v is string => !!v),
    );
    const existingPeople = new Set(
      profiles
        .filter((p) => p.date_of_birth)
        .map((p) => `${p.user.name.trim().toLowerCase()}|${p.date_of_birth!.toISOString().slice(0, 10)}`),
    );
    return { deptByName, roles, systemRoleByName, orgUserByEmail, orgUserByName, existingCodes, existingPeople };
  }

  /** Pure per-row + cross-row evaluation. No DB writes. */
  private evaluate(rows: BulkImportRowDto[], ctx: ImportContext): Prepared[] {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const prepared: Prepared[] = rows.map((row, index) => {
      const issues: ImportRowIssue[] = [];
      const err = (message: string, field?: string) => issues.push({ message, field, severity: 'error' });
      const warn = (message: string, field?: string) => issues.push({ message, field, severity: 'warning' });

      const name = (row.name ?? '').trim();
      const email = (row.email ?? '').trim().toLowerCase();
      if (!name) err('Name is required', 'name');
      if (!email) err('Email is required', 'email');
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err(`"${row.email}" is not a valid email`, 'email');

      // Department.
      const deptName = (row.department ?? '').trim();
      let dept: { id: string; name: string } | undefined;
      if (!deptName) err('Department is required', 'department');
      else {
        dept = ctx.deptByName.get(deptName.toLowerCase());
        if (!dept) err(`Department "${deptName}" not found`, 'department');
      }

      // Role — accepts "Role · Department" combined value or a plain title.
      const roleRaw = (row.role ?? '').trim();
      let role: { id: string; title: string } | undefined;
      if (!roleRaw) err('Role is required', 'role');
      else if (dept) {
        const [roleTitle, roleDept] = this.splitCombined(roleRaw);
        if (roleDept && dept && roleDept.toLowerCase() !== dept.name.toLowerCase()) {
          err(`Role belongs to "${roleDept}" but the Department column says "${dept.name}"`, 'role');
        } else {
          const match = ctx.roles.find(
            (r) => r.department_id === dept!.id && r.title.trim().toLowerCase() === roleTitle.toLowerCase(),
          );
          if (!match) err(`Role "${roleTitle}" not found in department "${dept.name}"`, 'role');
          else role = { id: match.id, title: match.title };
        }
      }

      // System Role — required.
      const sysRaw = (row.system_role ?? '').trim();
      let systemRole: { id: string; name: string } | undefined;
      if (!sysRaw) err('System Role is required', 'system_role');
      else {
        systemRole = ctx.systemRoleByName.get(sysRaw.toLowerCase());
        if (!systemRole) err(`System Role "${sysRaw}" not found`, 'system_role');
      }

      // Employment type.
      let employmentType: EmploymentType = EmploymentType.full_time;
      const etRaw = (row.employment_type ?? '').trim();
      if (etRaw) {
        const et = etRaw.toLowerCase().replace(/[\s-]+/g, '_');
        if (!EMPLOYMENT_TYPES.includes(et)) err(`Employment type "${etRaw}" must be full_time, part_time or contract`, 'employment_type');
        else employmentType = et as EmploymentType;
      }

      // Dates.
      const dateOfBirth = this.parseDate(row.date_of_birth, 'Date of birth', today, err);
      const dateOfJoining = this.parseDate(row.date_of_joining, 'Date of joining', today, err);
      const marriageDate = this.parseDate(row.marriage_date, 'Marriage date', today, err);
      if (dateOfBirth) {
        const age = (today.getTime() - dateOfBirth.getTime()) / (365.25 * 864e5);
        if (age < MIN_AGE_YEARS) err(`Date of birth implies an age under ${MIN_AGE_YEARS}`, 'date_of_birth');
        else if (age > MAX_AGE_YEARS) err('Date of birth is unrealistically old', 'date_of_birth');
      }
      if (dateOfBirth && dateOfJoining && dateOfJoining.getTime() < dateOfBirth.getTime())
        err('Date of joining is before date of birth', 'date_of_joining');
      if (dateOfBirth && marriageDate && marriageDate.getTime() <= dateOfBirth.getTime())
        err('Marriage date is on or before date of birth', 'marriage_date');

      // Employee code (org clash; within-file handled below).
      const employeeCode = (row.employee_code ?? '').trim() || undefined;
      let isDuplicate = false;
      if (employeeCode && ctx.existingCodes.has(employeeCode.toLowerCase())) {
        issues.push({ message: `Employee code "${employeeCode}" is already used in this organization`, field: 'employee_code', severity: 'error' });
        isDuplicate = true;
      }

      // Email already a member (hard duplicate).
      if (email && ctx.orgUserByEmail.has(email)) {
        issues.push({ message: 'A user with this email already exists in this organization', field: 'email', severity: 'error' });
        isDuplicate = true;
      }

      // Soft duplicate: same name + DOB as an existing person.
      if (name && dateOfBirth) {
        const key = `${name.toLowerCase()}|${dateOfBirth.toISOString().slice(0, 10)}`;
        if (ctx.existingPeople.has(key)) warn('Possible duplicate — same name and date of birth as an existing employee');
      }

      // Manager — captured here, resolved in crossRowChecks once file rows are indexed.
      const managerRaw = (row.reporting_to ?? '').trim();
      const managerLabel = managerRaw || undefined;

      const password = (row.password ?? '').trim() || DEFAULT_IMPORT_PASSWORD;
      if (password.length < 8) err('Password must be at least 8 characters', 'password');

      return {
        index,
        rowNum: index + 2,
        name,
        email,
        password,
        dept,
        role,
        systemRole,
        employmentType,
        employeeCode,
        dateOfJoining,
        dateOfBirth,
        marriageDate,
        managerRef: null,
        managerRaw,
        managerLabel,
        issues,
        isDuplicate,
      };
    });

    this.crossRowChecks(prepared, ctx);
    return prepared;
  }

  /** Within-file email/code duplicates, self-management and reporting cycles. */
  private crossRowChecks(prepared: Prepared[], ctx: ImportContext): void {
    // Email duplicates within the file → mark 2nd+ occurrences.
    const seenEmail = new Map<string, number>();
    const seenCode = new Map<string, number>();
    const byEmail = new Map<string, Prepared>();
    const byName = new Map<string, Prepared[]>();
    for (const p of prepared) {
      if (p.email) byEmail.set(p.email, p);
      const nk = p.name.toLowerCase();
      byName.set(nk, [...(byName.get(nk) ?? []), p]);
    }
    for (const p of prepared) {
      if (p.email) {
        const n = (seenEmail.get(p.email) ?? 0) + 1;
        seenEmail.set(p.email, n);
        if (n > 1) {
          p.issues.push({ message: 'Duplicate email — appears earlier in this file', field: 'email', severity: 'error' });
          p.isDuplicate = true;
        }
      }
      if (p.employeeCode) {
        const ck = p.employeeCode.toLowerCase();
        const n = (seenCode.get(ck) ?? 0) + 1;
        seenCode.set(ck, n);
        if (n > 1) {
          p.issues.push({ message: 'Duplicate employee code — appears earlier in this file', field: 'employee_code', severity: 'error' });
          p.isDuplicate = true;
        }
      }
    }

    // File-row indexes for resolving managers defined within this same file.
    const fileByName = new Map<string, Prepared[]>();
    for (const p of prepared) {
      if (!p.name) continue;
      const nk = p.name.toLowerCase();
      fileByName.set(nk, [...(fileByName.get(nk) ?? []), p]);
    }

    // Resolve each row's manager: existing org member first, else a row in this file.
    for (const p of prepared) {
      if (!p.managerRaw) continue;
      const raw = p.managerRaw;
      let ref: ManagerRef = null;
      if (raw.includes('@')) {
        const email = raw.toLowerCase();
        const existing = ctx.orgUserByEmail.get(email);
        if (existing) ref = { kind: 'user', id: existing.id };
        else if (byEmail.has(email)) ref = { kind: 'file', email };
        else p.issues.push({ message: `Manager "${raw}" is not a member of this organization`, field: 'reporting_to', severity: 'error' });
      } else {
        const name = this.splitCombined(raw)[0].toLowerCase();
        const orgIds = ctx.orgUserByName.get(name);
        if (orgIds && orgIds.length === 1) ref = { kind: 'user', id: orgIds[0] };
        else if (orgIds && orgIds.length > 1)
          p.issues.push({ message: `Multiple people are named "${raw}" — use their email instead`, field: 'reporting_to', severity: 'error' });
        else {
          const fileMatches = fileByName.get(name) ?? [];
          if (fileMatches.length === 1) ref = { kind: 'file', email: fileMatches[0].email };
          else if (fileMatches.length > 1)
            p.issues.push({ message: `Multiple rows are named "${raw}" — use an email to disambiguate`, field: 'reporting_to', severity: 'error' });
          else p.issues.push({ message: `Manager "${raw}" is not a member of this organization`, field: 'reporting_to', severity: 'error' });
        }
      }
      // Self-management.
      if (ref?.kind === 'file' && ref.email === p.email) {
        p.issues.push({ message: 'An employee cannot report to themselves', field: 'reporting_to', severity: 'error' });
        ref = null;
      }
      p.managerRef = ref;
    }

    // Reporting cycles among file rows.
    const edge = new Map<string, string>(); // email -> manager email (file refs only)
    for (const p of prepared) {
      if (p.email && p.managerRef?.kind === 'file') edge.set(p.email, p.managerRef.email);
    }
    const color = new Map<string, number>(); // 0=visiting,1=done
    const inCycle = new Set<string>();
    for (const start of edge.keys()) {
      const path: string[] = [];
      let cur: string | undefined = start;
      const local = new Set<string>();
      while (cur && edge.has(cur) && !color.has(cur)) {
        if (local.has(cur)) {
          // cycle from first occurrence of cur
          const i = path.indexOf(cur);
          for (const e of path.slice(i)) inCycle.add(e);
          inCycle.add(cur);
          break;
        }
        local.add(cur);
        path.push(cur);
        cur = edge.get(cur);
      }
      for (const e of local) color.set(e, 1);
    }
    for (const p of prepared) {
      if (p.email && inCycle.has(p.email)) {
        p.issues.push({ message: 'Reporting cycle — these rows report to each other', field: 'reporting_to', severity: 'error' });
        p.managerRef = null;
      }
    }
  }

  private parseDate(
    raw: string | undefined,
    field: string,
    today: Date,
    err: (m: string, f?: string) => void,
  ): Date | undefined {
    const v = raw?.trim();
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) {
      err(`${field} "${v}" is not a valid date (use YYYY-MM-DD)`, this.fieldKey(field));
      return undefined;
    }
    if (d.getTime() > today.getTime()) {
      err(`${field} cannot be in the future`, this.fieldKey(field));
      return undefined;
    }
    return d;
  }

  private fieldKey(label: string): string {
    return label.toLowerCase().replace(/\s+/g, '_');
  }

  private splitCombined(v: string): string[] {
    return v.split(VALUE_SEPARATOR).map((s) => s.trim());
  }

  /** Order ready rows so a manager defined in the file is created before its reports. */
  private topoOrder(ready: Prepared[]): Prepared[] {
    const byEmail = new Map<string, Prepared>();
    for (const p of ready) byEmail.set(p.email, p);
    const visited = new Set<string>();
    const out: Prepared[] = [];
    const visit = (p: Prepared, stack: Set<string>) => {
      if (visited.has(p.email)) return;
      if (stack.has(p.email)) return; // cycle guard (already filtered, belt-and-suspenders)
      stack.add(p.email);
      if (p.managerRef?.kind === 'file') {
        const mgr = byEmail.get(p.managerRef.email);
        if (mgr) visit(mgr, stack);
      }
      stack.delete(p.email);
      visited.add(p.email);
      out.push(p);
    };
    for (const p of ready) visit(p, new Set());
    return out;
  }

  private toValidationResult(prepared: Prepared[]): ImportValidationResult {
    const rows: ImportValidationRow[] = prepared.map((p) => {
      const hasError = p.issues.some((i) => i.severity === 'error');
      const status: ImportValidationRow['status'] = p.isDuplicate ? 'duplicate' : hasError ? 'error' : 'ready';
      const resolved: ImportResolved = {
        department: p.dept?.name,
        role: p.role ? `${p.role.title}${p.dept ? VALUE_SEPARATOR + p.dept.name : ''}` : undefined,
        system_role: p.systemRole?.name,
        reporting_to: p.managerLabel,
        employment_type: p.employmentType,
      };
      return { row: p.rowNum, name: p.name, email: p.email, status, resolved, issues: p.issues };
    });
    return {
      total: rows.length,
      ready: rows.filter((r) => r.status === 'ready').length,
      duplicates: rows.filter((r) => r.status === 'duplicate').length,
      errors: rows.filter((r) => r.status === 'error').length,
      warnings: rows.filter((r) => r.issues.some((i) => i.severity === 'warning')).length,
      rows,
    };
  }

  private sortResults(results: BulkImportRowResult[]): BulkImportRowResult[] {
    return [...results].sort((a, b) => a.row - b.row);
  }
}
