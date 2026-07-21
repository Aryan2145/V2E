// TEMPORARY (not committed): measures employees.findAll and tasks.listTasks
// against the seeded scratch DB. Counts SQL statements via pg Client.query.
import { Client } from 'pg';
const counter = { n: 0 };
const origCq: any = (Client.prototype as any).query;
(Client.prototype as any).query = function (...args: any[]) {
  counter.n++;
  return origCq.apply(this, args);
};

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { TasksService } from '../tasks/tasks.service';

const ORG = 'b2b49543-ebd7-4399-828f-2a4564a2084e';
const ADMIN = '46479585-ffde-4ddb-9373-1c3c43655b09';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const employees = app.get(EmployeesService);
  const tasks = app.get(TasksService);
  const principal = { userId: ADMIN, systemRoleId: null, isAdmin: true, isSuperAdmin: true };

  await prisma.organization.count(); // warm up

  async function measure(label: string, fn: () => Promise<any>) {
    counter.n = 0;
    const t0 = Date.now();
    const res = await fn();
    const ms = Date.now() - t0;
    const rows = Array.isArray(res) ? res.length : Array.isArray(res?.items) ? res.items.length : '?';
    console.log(`${label}  queries=${counter.n}  wall_ms=${ms}  rows_returned=${rows}`);
  }

  await measure('EMPLOYEES.findAll', () => employees.findAll(ORG));
  await measure('TASKS.listTasks  ', () => tasks.listTasks(ORG, principal as any, {} as any));

  await app.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
