/**
 * Seed: "Helix Group" — a holding group of 3 TEST companies with ~40 people,
 * overlapping membership (12 in all three / 12 in two / 16 in one), full
 * departments, roles, a professional reporting hierarchy, per-org config
 * defaults, and sample operational data.
 *
 * Run:  npx ts-node --transpile-only prisma/seed-test-group.ts
 * Idempotent: safe to re-run (upserts on unique keys, check-then-create elsewhere).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const rawUrl = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/orgos?schema=public';
const needsSsl = rawUrl.includes('sslmode');
const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;
const adapter = new PrismaPg({ connectionString, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'Admin@123';

type Co = 'tech' | 'fin' | 'retail';

interface Assignment {
  co: Co;
  dept: string;
  title: string;
  level: 'junior' | 'mid' | 'senior' | 'lead' | 'head';
  manager?: string | null; // manager email in the SAME company
  member?: 'org_admin' | 'hr_manager' | 'employee';
  head?: boolean; // is the head of `dept` in `co`
}
interface Person {
  name: string;
  email: string;
  assignments: Assignment[];
}

// ─── Company catalog ────────────────────────────────────────────────────────────

const COMPANIES: Record<Co, { slug: string; name: string; industry: string }> = {
  tech: { slug: 'helix-tech', name: 'Helix Technologies', industry: 'Software' },
  fin: { slug: 'helix-financial', name: 'Helix Financial Services', industry: 'Financial Services' },
  retail: { slug: 'helix-retail', name: 'Helix Retail', industry: 'Retail' },
};

const CEO = 'aarav.kapoor@helix.test';

// ─── People (40) ──────────────────────────────────────────────────────────────
// 12 in all three, 12 in exactly two, 16 in one.

const PEOPLE: Person[] = [
  // ── 12 GROUP people — present in ALL THREE companies (corporate functions) ──
  { name: 'Aarav Kapoor', email: CEO, assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Executive', title: 'Group Chief Executive Officer', level: 'head', manager: null, member: 'org_admin', head: true })) },
  { name: 'Diya Malhotra', email: 'diya.malhotra@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Finance', title: 'Group Chief Financial Officer', level: 'head', manager: CEO, member: 'hr_manager', head: true })) },
  { name: 'Kabir Reddy', email: 'kabir.reddy@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Human Resources', title: 'Group Chief HR Officer', level: 'head', manager: CEO, member: 'hr_manager', head: true })) },
  { name: 'Ananya Iyer', email: 'ananya.iyer@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'IT', title: 'Group Chief Information Officer', level: 'head', manager: CEO, member: 'employee', head: true })) },
  { name: 'Rohan Verma', email: 'rohan.verma@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Legal & Compliance', title: 'Group General Counsel', level: 'head', manager: CEO, member: 'employee', head: true })) },
  { name: 'Ishaan Khanna', email: 'ishaan.khanna@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Finance', title: 'Group Financial Controller', level: 'senior', manager: 'diya.malhotra@helix.test', member: 'employee' })) },
  { name: 'Meera Joshi', email: 'meera.joshi@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Human Resources', title: 'Group HR Business Partner', level: 'senior', manager: 'kabir.reddy@helix.test', member: 'hr_manager' })) },
  { name: 'Vivaan Rao', email: 'vivaan.rao@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'IT', title: 'Group IT Manager', level: 'lead', manager: 'ananya.iyer@helix.test', member: 'employee' })) },
  { name: 'Saanvi Nair', email: 'saanvi.nair@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Legal & Compliance', title: 'Group Compliance Officer', level: 'senior', manager: 'rohan.verma@helix.test', member: 'employee' })) },
  { name: 'Aditya Menon', email: 'aditya.menon@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Finance', title: 'FP&A Analyst', level: 'mid', manager: 'ishaan.khanna@helix.test', member: 'employee' })) },
  { name: 'Riya Shah', email: 'riya.shah@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'Human Resources', title: 'Payroll Specialist', level: 'mid', manager: 'meera.joshi@helix.test', member: 'employee' })) },
  { name: 'Arjun Pillai', email: 'arjun.pillai@helix.test', assignments: (['tech', 'fin', 'retail'] as Co[]).map((co) => ({ co, dept: 'IT', title: 'Security Engineer', level: 'senior', manager: 'vivaan.rao@helix.test', member: 'employee' })) },

  // ── 12 DUAL people — in exactly TWO companies ──
  // AB = tech + fin (4)
  { name: 'Neha Gupta', email: 'neha.gupta@helix.test', assignments: [
    { co: 'tech', dept: 'Sales', title: 'Head of Sales', level: 'lead', manager: CEO, head: true },
    { co: 'fin', dept: 'Sales', title: 'Sales Lead', level: 'lead', manager: CEO, head: true },
  ] },
  { name: 'Karan Singh', email: 'karan.singh@helix.test', assignments: [
    { co: 'tech', dept: 'Finance', title: 'Accountant', level: 'mid', manager: 'ishaan.khanna@helix.test' },
    { co: 'fin', dept: 'Finance', title: 'Senior Accountant', level: 'senior', manager: 'diya.malhotra@helix.test' },
  ] },
  { name: 'Pooja Desai', email: 'pooja.desai@helix.test', assignments: [
    { co: 'tech', dept: 'IT', title: 'IT Support Engineer', level: 'mid', manager: 'vivaan.rao@helix.test' },
    { co: 'fin', dept: 'IT', title: 'IT Support Engineer', level: 'mid', manager: 'vivaan.rao@helix.test' },
  ] },
  { name: 'Rahul Bose', email: 'rahul.bose@helix.test', assignments: [
    { co: 'tech', dept: 'Human Resources', title: 'Recruiter', level: 'mid', manager: 'meera.joshi@helix.test' },
    { co: 'fin', dept: 'Human Resources', title: 'Recruiter', level: 'mid', manager: 'meera.joshi@helix.test' },
  ] },
  // AC = tech + retail (4)
  { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@helix.test', assignments: [
    { co: 'tech', dept: 'Product', title: 'Head of Product', level: 'lead', manager: CEO, head: true },
    { co: 'retail', dept: 'Marketing', title: 'Head of Marketing', level: 'lead', manager: CEO, head: true },
  ] },
  { name: 'Aman Chauhan', email: 'aman.chauhan@helix.test', assignments: [
    { co: 'tech', dept: 'Engineering', title: 'Senior Software Engineer', level: 'senior', manager: 'manish.pandey@helix.test' },
    { co: 'retail', dept: 'IT', title: 'Senior IT Engineer', level: 'senior', manager: 'vivaan.rao@helix.test' },
  ] },
  { name: 'Tara Saxena', email: 'tara.saxena@helix.test', assignments: [
    { co: 'tech', dept: 'Finance', title: 'Accountant', level: 'mid', manager: 'ishaan.khanna@helix.test' },
    { co: 'retail', dept: 'Finance', title: 'Accountant', level: 'mid', manager: 'ishaan.khanna@helix.test' },
  ] },
  { name: 'Dev Agarwal', email: 'dev.agarwal@helix.test', assignments: [
    { co: 'tech', dept: 'Sales', title: 'Account Executive', level: 'mid', manager: 'neha.gupta@helix.test' },
    { co: 'retail', dept: 'Store Operations', title: 'Store Manager', level: 'mid', manager: 'lakshmi.pillai@helix.test' },
  ] },
  // BC = fin + retail (4)
  { name: 'Nisha Bhat', email: 'nisha.bhat@helix.test', assignments: [
    { co: 'fin', dept: 'Operations', title: 'Head of Operations', level: 'lead', manager: CEO, head: true },
    { co: 'retail', dept: 'Supply Chain', title: 'Head of Supply Chain', level: 'lead', manager: CEO, head: true },
  ] },
  { name: 'Yash Thakur', email: 'yash.thakur@helix.test', assignments: [
    { co: 'fin', dept: 'Investments', title: 'Investment Analyst', level: 'senior', manager: 'gaurav.malhotra@helix.test' },
    { co: 'retail', dept: 'Merchandising', title: 'Senior Merchandiser', level: 'senior', manager: 'preeti.chopra@helix.test' },
  ] },
  { name: 'Simran Kaur', email: 'simran.kaur@helix.test', assignments: [
    { co: 'fin', dept: 'Human Resources', title: 'HR Executive', level: 'mid', manager: 'meera.joshi@helix.test' },
    { co: 'retail', dept: 'Human Resources', title: 'HR Executive', level: 'mid', manager: 'meera.joshi@helix.test' },
  ] },
  { name: 'Aryan Sethi', email: 'aryan.sethi@helix.test', assignments: [
    { co: 'fin', dept: 'Sales', title: 'Relationship Manager', level: 'mid', manager: 'neha.gupta@helix.test' },
    { co: 'retail', dept: 'Store Operations', title: 'Assistant Store Manager', level: 'mid', manager: 'lakshmi.pillai@helix.test' },
  ] },

  // ── 16 SINGLE people — in ONE company ──
  // tech only (6)
  { name: 'Manish Pandey', email: 'manish.pandey@helix.test', assignments: [{ co: 'tech', dept: 'Engineering', title: 'VP of Engineering', level: 'head', manager: CEO, head: true }] },
  { name: 'Kritika Jain', email: 'kritika.jain@helix.test', assignments: [{ co: 'tech', dept: 'Engineering', title: 'Engineering Lead', level: 'lead', manager: 'manish.pandey@helix.test' }] },
  { name: 'Sahil Mehta', email: 'sahil.mehta@helix.test', assignments: [{ co: 'tech', dept: 'Engineering', title: 'Software Engineer', level: 'mid', manager: 'kritika.jain@helix.test' }] },
  { name: 'Anjali Rao', email: 'anjali.rao@helix.test', assignments: [{ co: 'tech', dept: 'Engineering', title: 'Junior Software Engineer', level: 'junior', manager: 'kritika.jain@helix.test' }] },
  { name: 'Farhan Ali', email: 'farhan.ali@helix.test', assignments: [{ co: 'tech', dept: 'Product', title: 'Product Manager', level: 'senior', manager: 'sneha.kulkarni@helix.test' }] },
  { name: 'Divya Nanda', email: 'divya.nanda@helix.test', assignments: [{ co: 'tech', dept: 'Product', title: 'Product Designer', level: 'mid', manager: 'sneha.kulkarni@helix.test' }] },
  // fin only (5)
  { name: 'Gaurav Malhotra', email: 'gaurav.malhotra@helix.test', assignments: [{ co: 'fin', dept: 'Investments', title: 'Head of Investments', level: 'head', manager: CEO, head: true }] },
  { name: 'Pallavi Sinha', email: 'pallavi.sinha@helix.test', assignments: [{ co: 'fin', dept: 'Investments', title: 'Senior Investment Analyst', level: 'senior', manager: 'gaurav.malhotra@helix.test' }] },
  { name: 'Rohit Khanna', email: 'rohit.khanna@helix.test', assignments: [{ co: 'fin', dept: 'Investments', title: 'Investment Associate', level: 'mid', manager: 'gaurav.malhotra@helix.test' }] },
  { name: 'Sonia George', email: 'sonia.george@helix.test', assignments: [{ co: 'fin', dept: 'Operations', title: 'Operations Specialist', level: 'senior', manager: 'nisha.bhat@helix.test' }] },
  { name: 'Vikas Yadav', email: 'vikas.yadav@helix.test', assignments: [{ co: 'fin', dept: 'Operations', title: 'Operations Executive', level: 'mid', manager: 'nisha.bhat@helix.test' }] },
  // retail only (5)
  { name: 'Preeti Chopra', email: 'preeti.chopra@helix.test', assignments: [{ co: 'retail', dept: 'Merchandising', title: 'Head of Merchandising', level: 'head', manager: CEO, head: true }] },
  { name: 'Naveen Kumar', email: 'naveen.kumar@helix.test', assignments: [{ co: 'retail', dept: 'Merchandising', title: 'Merchandiser', level: 'mid', manager: 'preeti.chopra@helix.test' }] },
  { name: 'Lakshmi Pillai', email: 'lakshmi.pillai@helix.test', assignments: [{ co: 'retail', dept: 'Store Operations', title: 'Head of Store Operations', level: 'head', manager: CEO, head: true }] },
  { name: 'Imran Sheikh', email: 'imran.sheikh@helix.test', assignments: [{ co: 'retail', dept: 'Store Operations', title: 'Store Supervisor', level: 'mid', manager: 'lakshmi.pillai@helix.test' }] },
  { name: 'Ritu Aggarwal', email: 'ritu.aggarwal@helix.test', assignments: [{ co: 'retail', dept: 'Supply Chain', title: 'Supply Chain Analyst', level: 'senior', manager: 'nisha.bhat@helix.test' }] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

const orgIds: Record<Co, string> = { tech: '', fin: '', retail: '' };
const userIds: Record<string, string> = {}; // email -> userId
const deptIds: Record<string, string> = {}; // `${co}:${dept}` -> deptId
const empCounters: Record<Co, number> = { tech: 0, fin: 0, retail: 0 };
const coPrefix: Record<Co, string> = { tech: 'HT', fin: 'HF', retail: 'HR' };

async function getOrCreateRole(orgId: string, deptId: string, title: string, level: string) {
  const existing = await prisma.role.findFirst({ where: { organization_id: orgId, department_id: deptId, title } });
  if (existing) return existing;
  return prisma.role.create({
    data: {
      organization_id: orgId,
      department_id: deptId,
      title,
      level: level as never,
      job_description: `${title} at the organization.`,
      kra: [{ title: 'Deliver on objectives', description: `Own and deliver ${title} responsibilities.` }] as never,
      kpi: [{ title: 'Goal completion', metric: '%', target: '90', unit: '%' }] as never,
    },
  });
}

async function seedOrgDefaults(orgId: string, coName: string) {
  // ── Task config ──
  await prisma.taskMaster.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId }, update: {} });
  if ((await prisma.taskPriority.count({ where: { organization_id: orgId } })) === 0) {
    await prisma.taskPriority.createMany({ data: [
      { organization_id: orgId, label: 'Critical', color: '#DC2626', order_index: 0 },
      { organization_id: orgId, label: 'High', color: '#EA580C', order_index: 1 },
      { organization_id: orgId, label: 'Medium', color: '#D97706', order_index: 2 },
      { organization_id: orgId, label: 'Low', color: '#2563EB', order_index: 3 },
    ] });
  }
  if ((await prisma.taskStatus.count({ where: { organization_id: orgId } })) === 0) {
    await prisma.taskStatus.createMany({ data: [
      { organization_id: orgId, label: 'To Do', type: 'todo', color: '#6B7280', order_index: 0, is_default: true },
      { organization_id: orgId, label: 'In Progress', type: 'in_progress', color: '#2563EB', order_index: 1 },
      { organization_id: orgId, label: 'Done', type: 'completed', color: '#16A34A', order_index: 2 },
    ] });
  }
  if ((await prisma.taskCategory.count({ where: { organization_id: orgId } })) === 0) {
    const creator = userIds[CEO];
    await prisma.taskCategory.createMany({ data: [
      { organization_id: orgId, name: 'General', color: '#2563EB', created_by_user_id: creator },
      { organization_id: orgId, name: 'Operations', color: '#0891B2', created_by_user_id: creator },
      { organization_id: orgId, name: 'Compliance', color: '#DC2626', created_by_user_id: creator },
    ] });
  }

  // ── Ticket config ──
  await prisma.ticketMaster.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId }, update: {} });
  if ((await prisma.ticketType.count({ where: { organization_id: orgId } })) === 0) {
    await prisma.ticketType.createMany({ data: [
      { organization_id: orgId, name: 'Issue', color: '#2563EB', icon: '🐛', default_sla_days: 3, order_index: 0 },
      { organization_id: orgId, name: 'Service Request', color: '#0891B2', icon: '🛎️', default_sla_days: 5, order_index: 1 },
      { organization_id: orgId, name: 'Complaint', color: '#DC2626', icon: '📢', default_sla_days: 7, order_index: 2 },
      { organization_id: orgId, name: 'Query', color: '#D97706', icon: '❓', default_sla_days: 2, order_index: 3 },
    ] });
  }
  if ((await prisma.ticketPriority.count({ where: { organization_id: orgId } })) === 0) {
    await prisma.ticketPriority.createMany({ data: [
      { organization_id: orgId, label: 'Critical', color: '#DC2626', sla_days: 1, order_index: 0 },
      { organization_id: orgId, label: 'High', color: '#D97706', sla_days: 2, order_index: 1 },
      { organization_id: orgId, label: 'Medium', color: '#2563EB', sla_days: 5, order_index: 2 },
      { organization_id: orgId, label: 'Low', color: '#475569', sla_days: 10, order_index: 3 },
    ] });
  }
  if ((await prisma.ticketStatus.count({ where: { organization_id: orgId } })) === 0) {
    await prisma.ticketStatus.createMany({ data: [
      { organization_id: orgId, label: 'Open', type: 'open', color: '#2563EB', order_index: 0, is_default: true },
      { organization_id: orgId, label: 'Assigned', type: 'assigned', color: '#0891B2', order_index: 1 },
      { organization_id: orgId, label: 'Accepted & In Progress', type: 'in_progress', color: '#D97706', order_index: 2 },
      { organization_id: orgId, label: 'Resolved', type: 'resolved', color: '#16A34A', order_index: 3 },
      { organization_id: orgId, label: 'Closed — Resolved', type: 'closed_resolved', color: '#15803D', order_index: 4 },
      { organization_id: orgId, label: 'Closed — Unresolved', type: 'closed_unresolved', color: '#DC2626', order_index: 5 },
    ] });
  }

  // ── Holiday + workflow + project masters ──
  await prisma.holidayMaster.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId }, update: {} });
  await prisma.orgWorkingDays.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId }, update: {} });
  await prisma.workflowMaster.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId }, update: {} });
  await prisma.projectMaster.upsert({ where: { organization_id: orgId }, create: { organization_id: orgId }, update: {} });

  // ── Org identity ──
  await prisma.orgIdentity.upsert({
    where: { organization_id: orgId },
    update: {},
    create: {
      organization_id: orgId,
      vision: `To be the most trusted name in ${coName.replace('Helix ', '')}.`,
      mission: 'Deliver exceptional value to customers through clarity, speed, and integrity.',
      purpose: 'Empower our people and customers to do their best work.',
      values: [
        { title: 'Integrity', description: 'We do what we say.' },
        { title: 'Ownership', description: 'We own our outcomes.' },
        { title: 'Customer First', description: 'Every decision starts with the customer.' },
      ] as never,
    },
  });
}

// ─── Department layout (org chart positions) ────────────────────────────────────

const DEPTS: Record<Co, string[]> = {
  tech: ['Executive', 'Finance', 'Human Resources', 'IT', 'Legal & Compliance', 'Engineering', 'Product', 'Sales'],
  fin: ['Executive', 'Finance', 'Human Resources', 'IT', 'Legal & Compliance', 'Investments', 'Operations', 'Sales'],
  retail: ['Executive', 'Finance', 'Human Resources', 'IT', 'Legal & Compliance', 'Merchandising', 'Supply Chain', 'Store Operations', 'Marketing'],
};

async function main() {
  console.log('🌱 Seeding Helix Group (3 test companies)…');
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // 1) Group
  const group = await prisma.organizationGroup.upsert({
    where: { slug: 'helix-group' },
    update: {},
    create: { name: 'Helix Group', slug: 'helix-group', description: 'Holding group of three sister companies (test).' },
  });

  // 2) Companies (test orgs)
  for (const co of Object.keys(COMPANIES) as Co[]) {
    const c = COMPANIES[co];
    const org = await prisma.organization.upsert({
      where: { slug: c.slug },
      update: { is_test: true, group_id: group.id, status: 'active' },
      create: {
        name: c.name, slug: c.slug, industry: c.industry, country: 'India',
        timezone: 'Asia/Kolkata', status: 'active', is_test: true, group_id: group.id,
      },
    });
    orgIds[co] = org.id;
    console.log(`✅ Company: ${c.name} (test)`);
  }

  // 3) Departments per company (Executive is root; others child of Executive)
  for (const co of Object.keys(COMPANIES) as Co[]) {
    const orgId = orgIds[co];
    const names = DEPTS[co];
    // Executive first
    const exec = await ensureDept(orgId, co, 'Executive', null, 600, 40);
    let i = 0;
    for (const name of names) {
      if (name === 'Executive') continue;
      const x = 120 + i * 230;
      await ensureDept(orgId, co, name, exec, x, 280);
      i++;
    }
  }

  // 4) Per-org config defaults + identity (needs CEO user for category creator → create CEO first)
  // Create all users up-front (no org context needed)
  for (const p of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: { name: p.name, email: p.email, password_hash: passwordHash, is_active: true },
    });
    userIds[p.email] = user.id;
  }
  for (const co of Object.keys(COMPANIES) as Co[]) {
    await seedOrgDefaults(orgIds[co], COMPANIES[co].name);
  }

  // 5) Pass 1 — memberships + roles + profiles (no manager yet)
  for (const p of PEOPLE) {
    for (const a of p.assignments) {
      const orgId = orgIds[a.co];
      const userId = userIds[p.email];
      const deptId = deptIds[`${a.co}:${a.dept}`];
      const role = await getOrCreateRole(orgId, deptId, a.title, a.level);

      // membership
      const existingMember = await prisma.organizationMember.findUnique({
        where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
      });
      if (!existingMember) {
        const memberRole = a.member ?? 'employee';
        await prisma.organizationMember.create({ data: { organization_id: orgId, user_id: userId, is_admin: memberRole === 'org_admin' } });
      }

      // profile (one per org+user)
      empCounters[a.co] += 1;
      const code = `${coPrefix[a.co]}-EMP${String(empCounters[a.co]).padStart(3, '0')}`;
      await prisma.employeeProfile.upsert({
        where: { organization_id_user_id: { organization_id: orgId, user_id: userId } },
        update: { role_id: role.id, department_id: deptId },
        create: {
          organization_id: orgId, user_id: userId, role_id: role.id, department_id: deptId,
          employee_code: code, employment_type: 'full_time' as never,
          date_of_joining: new Date(2020 + (empCounters[a.co] % 5), (empCounters[a.co] * 2) % 12, ((empCounters[a.co] * 3) % 27) + 1),
        },
      });
    }
  }

  // 6) Pass 2 — reporting lines + department heads
  for (const p of PEOPLE) {
    for (const a of p.assignments) {
      if (!a.manager) continue;
      const managerUserId = userIds[a.manager];
      if (!managerUserId) { console.warn(`⚠️  manager ${a.manager} not found for ${p.email}`); continue; }
      await prisma.employeeProfile.update({
        where: { organization_id_user_id: { organization_id: orgIds[a.co], user_id: userIds[p.email] } },
        data: { reporting_to_user_id: managerUserId },
      });
    }
  }
  // Department heads
  for (const p of PEOPLE) {
    for (const a of p.assignments) {
      if (!a.head) continue;
      await prisma.department.update({ where: { id: deptIds[`${a.co}:${a.dept}`] }, data: { head_user_id: userIds[p.email] } });
    }
  }
  console.log(`✅ ${PEOPLE.length} people, memberships, profiles & reporting created`);

  // 7) Sample operational data
  for (const co of Object.keys(COMPANIES) as Co[]) {
    await seedSampleActivity(co);
  }

  console.log('\n🎉 Helix Group seed complete!');
  console.log('   Login (any person): <email> / Admin@123');
  console.log(`   Group CEO (admin in all 3): ${CEO} / Admin@123`);
}

async function ensureDept(orgId: string, co: Co, name: string, parentId: string | null, x: number, y: number): Promise<string> {
  let dept = await prisma.department.findFirst({ where: { organization_id: orgId, name } });
  if (!dept) {
    dept = await prisma.department.create({
      data: { organization_id: orgId, name, description: `${name} department`, parent_department_id: parentId ?? undefined, position_x: x, position_y: y },
    });
  }
  deptIds[`${co}:${name}`] = dept.id;
  return dept.id;
}

// ─── Sample activity per company ────────────────────────────────────────────────

async function seedSampleActivity(co: Co) {
  const orgId = orgIds[co];
  const statuses = await prisma.taskStatus.findMany({ where: { organization_id: orgId } });
  const priorities = await prisma.taskPriority.findMany({ where: { organization_id: orgId } });
  const todo = statuses.find((s) => s.is_default) ?? statuses[0];
  const inProgress = statuses.find((s) => s.type === 'in_progress') ?? todo;
  const done = statuses.find((s) => s.type === 'completed') ?? todo;
  const pHigh = priorities.find((p) => p.label === 'High') ?? priorities[0];
  const pMed = priorities.find((p) => p.label === 'Medium') ?? priorities[0];
  const ceo = userIds[CEO];

  // pick a couple of org members as assignees
  const members = await prisma.organizationMember.findMany({ where: { organization_id: orgId }, take: 6 });
  const someUser = (i: number) => members[i % members.length]?.user_id ?? ceo;

  const day = 86_400_000;
  const now = Date.now();

  // ── Tasks (idempotent by title) ──
  const taskSpecs = [
    { title: 'Prepare quarterly board deck', status: inProgress.id, priority: pHigh.id, deadline: new Date(now + 3 * day), assignee: someUser(0) },
    { title: 'Review and approve vendor contracts', status: todo.id, priority: pMed.id, deadline: new Date(now + 7 * day), assignee: someUser(1) },
    { title: 'Update employee handbook', status: todo.id, priority: pMed.id, deadline: new Date(now - 2 * day), assignee: someUser(2) }, // overdue
    { title: 'Roll out new expense policy', status: done.id, priority: pMed.id, deadline: new Date(now - 5 * day), assignee: someUser(3) },
  ];
  for (const t of taskSpecs) {
    const exists = await prisma.task.findFirst({ where: { organization_id: orgId, title: t.title } });
    if (exists) continue;
    const task = await prisma.task.create({
      data: { organization_id: orgId, title: t.title, status_id: t.status, priority_id: t.priority, deadline: t.deadline, created_by_user_id: ceo, type: 'one_time' as never },
    });
    await prisma.taskAssignee.create({ data: { organization_id: orgId, task_id: task.id, user_id: t.assignee, is_cc: false } });
    // give the overdue one an active escalation so the time-travel clock can fire it
    if (t.title.startsWith('Update employee handbook')) {
      await prisma.taskEscalation.create({ data: { organization_id: orgId, task_id: task.id, level: 1, escalate_to_user_id: ceo, is_active: true } });
    }
  }

  // ── Recurring templates (idempotent by title) ──
  const recSpecs = [
    { title: 'Daily standup notes', type: 'daily' as const, time: '09:30', days: [] as number[] },
    { title: 'Weekly team report', type: 'weekly' as const, time: '17:00', days: [5] }, // Friday
  ];
  for (const r of recSpecs) {
    const exists = await prisma.recurringTemplate.findFirst({ where: { organization_id: orgId, title: r.title } });
    if (exists) continue;
    const tpl = await prisma.recurringTemplate.create({
      data: {
        organization_id: orgId, title: r.title, description: `${r.title} (auto-generated)`,
        assignee_user_ids: [someUser(0), someUser(1)] as never, cc_user_ids: [] as never,
        priority_id: pMed.id, created_by_user_id: ceo,
      },
    });
    await prisma.recurringScheduleEntry.create({
      data: {
        organization_id: orgId, recurring_template_id: tpl.id, schedule_type: r.type as never,
        every: 1, days: r.days as never, time: r.time, start_date: new Date(now - 1 * day), end_condition: 'never' as never, order_index: 0,
      },
    });
  }

  // ── Tickets (idempotent by ticket_number) ──
  const ttype = await prisma.ticketType.findFirst({ where: { organization_id: orgId, name: 'Issue' } });
  const tstatusOpen = await prisma.ticketStatus.findFirst({ where: { organization_id: orgId, type: 'open' } });
  const tprioHigh = await prisma.ticketPriority.findFirst({ where: { organization_id: orgId, label: 'High' } });
  if (ttype && tstatusOpen) {
    const ticketSpecs = [
      { num: `${coPrefix[co]}-0001`, title: 'Laptop not booting', slaDueOffset: 2 * day },
      { num: `${coPrefix[co]}-0002`, title: 'VPN access request', slaDueOffset: 4 * day },
      { num: `${coPrefix[co]}-0003`, title: 'Payroll discrepancy', slaDueOffset: -1 * day }, // overdue SLA
    ];
    for (const tk of ticketSpecs) {
      const exists = await prisma.ticket.findFirst({ where: { organization_id: orgId, ticket_number: tk.num } });
      if (exists) continue;
      await prisma.ticket.create({
        data: {
          organization_id: orgId, ticket_number: tk.num, title: tk.title,
          ticket_type_id: ttype.id, status_id: tstatusOpen.id, priority_id: tprioHigh?.id,
          raised_by_user_id: someUser(2), assigned_to_user_id: someUser(0),
          sla_days: 3, sla_due_at: new Date(now + tk.slaDueOffset), sla_breached: false,
        },
      });
    }
  }

  // ── Project with milestones (idempotent by name) ──
  const projName = `${COMPANIES[co].name} — Annual Plan`;
  const existingProj = await prisma.project.findFirst({ where: { organization_id: orgId, name: projName } });
  if (!existingProj) {
    const pmUser = members[0]?.user_id ?? ceo;
    const project = await prisma.project.create({
      data: {
        organization_id: orgId, name: projName, description: 'Company-wide annual initiative.',
        status: 'active' as never, created_by_user_id: ceo, project_manager_user_id: pmUser,
        start_date: new Date(now - 10 * day), end_date: new Date(now + 80 * day), planned_budget: 5_000_000, currency: 'INR',
        total_milestones: 3,
      },
    });
    await prisma.projectMember.createMany({ data: [
      { organization_id: orgId, project_id: project.id, user_id: pmUser, role: 'manager' as never, added_by_user_id: ceo },
      { organization_id: orgId, project_id: project.id, user_id: someUser(1), role: 'editor' as never, added_by_user_id: ceo },
      { organization_id: orgId, project_id: project.id, user_id: someUser(2), role: 'viewer' as never, added_by_user_id: ceo },
    ], skipDuplicates: true });
    await prisma.projectMilestone.createMany({ data: [
      { organization_id: orgId, project_id: project.id, name: 'Kickoff & Planning', order_index: 0, due_date: new Date(now + 7 * day), status: 'in_progress' as never },
      { organization_id: orgId, project_id: project.id, name: 'Execution', order_index: 1, due_date: new Date(now + 45 * day), status: 'pending' as never },
      { organization_id: orgId, project_id: project.id, name: 'Review & Close', order_index: 2, due_date: new Date(now + 80 * day), status: 'pending' as never },
    ] });
  }

  // ── Holidays (idempotent by name+year) ──
  const year = new Date().getFullYear();
  const holidaySpecs = [
    { name: 'Republic Day', month: 0, dayOfMonth: 26, type: 'national' as const },
    { name: 'Independence Day', month: 7, dayOfMonth: 15, type: 'national' as const },
    { name: 'Founders Day', month: 5, dayOfMonth: 15, type: 'company' as const },
  ];
  for (const h of holidaySpecs) {
    const exists = await prisma.orgHoliday.findFirst({ where: { organization_id: orgId, name: h.name, year } });
    if (exists) continue;
    await prisma.orgHoliday.create({
      data: { organization_id: orgId, name: h.name, date: new Date(Date.UTC(year, h.month, h.dayOfMonth)), type: h.type as never, year, status: 'active' as never },
    });
  }

  console.log(`   ↳ sample activity seeded for ${COMPANIES[co].name}`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
