/**
 * One-off federation backfill: copies historical rows from the per-module
 * activity/audit tables into the central `audit_logs` store, preserving original
 * timestamps and semantic action names, mapping non-user actors to system.
 *
 * Idempotent: every backfilled row is tagged request_id = "backfill:<src>:<id>";
 * a re-run clears prior backfill rows first. The legacy tables are left intact.
 *
 * Run: npx ts-node src/scripts/audit-backfill.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const url = (process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/orgos?schema=public').replace(
  /[?&]sslmode=[^&]*/g,
  '',
);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type Row = {
  organization_id: string;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  resource: string;
  entity_id: string;
  entity_type: string | null;
  entity_label: string | null;
  changes: any;
  trigger_source: string | null;
  occurred_at: Date;
  created_at: Date;
  request_id: string;
};

async function main() {
  console.log('Loading users…');
  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((u) => u.id));
  const actor = (id: string | null) => (id && userIds.has(id) ? { actor_user_id: id, actor_type: 'user' } : { actor_user_id: null, actor_type: 'system' });

  console.log('Clearing prior backfill rows…');
  await prisma.auditLog.deleteMany({ where: { request_id: { startsWith: 'backfill:' } } });

  const out: Row[] = [];

  // ── Task / Ticket / Project activity logs (same shape) ───────────────────────
  const [tasks, tickets, projects] = await Promise.all([
    prisma.task.findMany({ select: { id: true, title: true } }),
    prisma.ticket.findMany({ select: { id: true, title: true } }),
    prisma.project.findMany({ select: { id: true, name: true } }),
  ]);
  const taskTitle = new Map(tasks.map((t) => [t.id, t.title]));
  const ticketTitle = new Map(tickets.map((t) => [t.id, t.title]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const taskLogs = await prisma.taskActivityLog.findMany();
  for (const l of taskLogs) {
    out.push({
      organization_id: l.organization_id,
      ...actor(l.performed_by_user_id),
      action: l.action,
      resource: 'task',
      entity_id: l.task_id,
      entity_type: 'Task',
      entity_label: taskTitle.get(l.task_id) ?? null,
      changes: (l.metadata as any) ?? null,
      trigger_source: null,
      occurred_at: l.created_at,
      created_at: l.created_at,
      request_id: `backfill:task_activity:${l.id}`,
    });
  }

  const ticketLogs = await prisma.ticketActivityLog.findMany();
  for (const l of ticketLogs) {
    out.push({
      organization_id: l.organization_id,
      ...actor(l.performed_by_user_id),
      action: l.action,
      resource: 'ticket',
      entity_id: l.ticket_id,
      entity_type: 'Ticket',
      entity_label: ticketTitle.get(l.ticket_id) ?? null,
      changes: (l.metadata as any) ?? null,
      trigger_source: l.action === 'sla_breached' || l.action === 'escalated' ? 'sla_breach' : null,
      occurred_at: l.created_at,
      created_at: l.created_at,
      request_id: `backfill:ticket_activity:${l.id}`,
    });
  }

  const projectLogs = await prisma.projectActivityLog.findMany();
  for (const l of projectLogs) {
    out.push({
      organization_id: l.organization_id,
      ...actor(l.performed_by_user_id),
      action: l.action,
      resource: 'project',
      entity_id: l.project_id,
      entity_type: 'Project',
      entity_label: projectName.get(l.project_id) ?? null,
      changes: (l.metadata as any) ?? null,
      trigger_source: null,
      occurred_at: l.created_at,
      created_at: l.created_at,
      request_id: `backfill:project_activity:${l.id}`,
    });
  }

  // Holiday-driven date adjustments now write directly to the shared audit log
  // (resource "holiday", system actor) — there is no separate holiday audit
  // store to backfill.

  console.log(`Inserting ${out.length} backfilled audit rows…`);
  // Chunk to keep the parameter count sane.
  for (let i = 0; i < out.length; i += 1000) {
    await prisma.auditLog.createMany({ data: out.slice(i, i + 1000) });
  }
  console.log('Backfill complete:', {
    task: taskLogs.length,
    ticket: ticketLogs.length,
    project: projectLogs.length,
    total: out.length,
  });
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
