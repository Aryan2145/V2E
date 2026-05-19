import { PrismaClient, UserRole, RoleLevel, EmploymentType, BehaviorType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const rawUrl = process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/orgos?schema=public';
const needsSsl = rawUrl.includes('sslmode');
const connectionString = needsSsl ? rawUrl.replace(/[?&]sslmode=[^&]*/g, '') : rawUrl;
const adapter = new PrismaPg({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding OrgOS database...');

  // Super Admin (organization_id is null so compound unique can't be used in upsert)
  const superAdmin = await prisma.user.findFirst({ where: { email: 'superadmin@orgos.io', organization_id: null } })
    ?? await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@orgos.io',
        password_hash: await bcrypt.hash('Admin@123', 12),
        role: UserRole.super_admin,
        organization_id: null,
      },
    });
  console.log('✅ Super Admin created:', superAdmin.email);

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      industry: 'Technology',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'active',
    },
  });
  console.log('✅ Organization created:', org.name);

  // Org Admin
  const orgAdmin = await prisma.user.upsert({
    where: { email_organization_id: { email: 'admin@acme.com', organization_id: org.id } },
    update: {},
    create: {
      name: 'Raj Mehta',
      email: 'admin@acme.com',
      password_hash: await bcrypt.hash('Admin@123', 12),
      role: UserRole.org_admin,
      organization_id: org.id,
    },
  });
  console.log('✅ Org Admin created:', orgAdmin.email);

  // HR Manager
  const hrManager = await prisma.user.upsert({
    where: { email_organization_id: { email: 'hr@acme.com', organization_id: org.id } },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'hr@acme.com',
      password_hash: await bcrypt.hash('Admin@123', 12),
      role: UserRole.hr_manager,
      organization_id: org.id,
    },
  });
  console.log('✅ HR Manager created:', hrManager.email);

  // Org Identity
  await prisma.orgIdentity.upsert({
    where: { organization_id: org.id },
    update: {},
    create: {
      organization_id: org.id,
      philosophy: 'We believe in building products that make people\'s lives simpler and more productive.',
      vision: 'To become the world\'s most trusted platform for organizational excellence.',
      mission: 'Empower every team with the tools and clarity they need to do their best work.',
      purpose: 'We exist to eliminate organizational chaos and replace it with clarity, alignment, and purpose.',
      values: [
        { title: 'Integrity', description: 'We do what we say, and say what we mean.' },
        { title: 'Innovation', description: 'We challenge the status quo every day.' },
        { title: 'Ownership', description: 'We take full responsibility for our outcomes.' },
        { title: 'Collaboration', description: 'We win together, never alone.' },
        { title: 'Customer First', description: 'Every decision starts with the customer in mind.' },
      ],
    },
  });
  console.log('✅ Org Identity created');

  // Culture Standards
  const cultureData = [
    { title: 'Speak Up', description: 'Share your honest opinion in meetings, even when it\'s uncomfortable.', type: BehaviorType.expected_behavior },
    { title: 'Respect Everyone', description: 'Treat every colleague with dignity regardless of their role or level.', type: BehaviorType.expected_behavior },
    { title: 'Own Your Mistakes', description: 'Acknowledge errors quickly, learn, and move forward constructively.', type: BehaviorType.expected_behavior },
    { title: 'Meet Deadlines', description: 'Communicate early if you foresee a delay — never miss silently.', type: BehaviorType.expected_behavior },
    { title: 'Harassment', description: 'Any form of bullying, harassment, or discrimination is a zero-tolerance offense.', type: BehaviorType.unacceptable_behavior },
    { title: 'Blame Culture', description: 'Pointing fingers at teammates instead of solving problems together.', type: BehaviorType.unacceptable_behavior },
    { title: 'Information Hoarding', description: 'Withholding information that others need to do their jobs effectively.', type: BehaviorType.unacceptable_behavior },
  ];

  for (const cs of cultureData) {
    await prisma.cultureStandard.create({ data: { ...cs, organization_id: org.id } });
  }
  console.log('✅ Culture Standards created');

  // Departments
  const ceoOffice = await prisma.department.create({
    data: { organization_id: org.id, name: 'CEO Office', description: 'Executive leadership and strategy', position_x: 400, position_y: 50 },
  });
  const hrDept = await prisma.department.create({
    data: { organization_id: org.id, name: 'Human Resources', description: 'People operations and talent', parent_department_id: ceoOffice.id, position_x: 100, position_y: 250 },
  });
  const salesDept = await prisma.department.create({
    data: { organization_id: org.id, name: 'Sales', description: 'Revenue generation and growth', parent_department_id: ceoOffice.id, position_x: 300, position_y: 250 },
  });
  const productDept = await prisma.department.create({
    data: { organization_id: org.id, name: 'Product', description: 'Product strategy and design', parent_department_id: ceoOffice.id, position_x: 500, position_y: 250 },
  });
  const techDept = await prisma.department.create({
    data: { organization_id: org.id, name: 'Technology', description: 'Engineering and infrastructure', parent_department_id: ceoOffice.id, position_x: 700, position_y: 250 },
  });
  console.log('✅ Departments created');

  // Roles per department
  const ceoRole = await prisma.role.create({
    data: {
      organization_id: org.id, department_id: ceoOffice.id, title: 'Chief Executive Officer',
      level: RoleLevel.head, job_description: 'Sets company vision, strategy, and leads the executive team.',
      kra: [{ title: 'Company Growth', description: 'Drive 30% YoY revenue growth' }, { title: 'Culture', description: 'Build and maintain a high-performance culture' }],
      kpi: [{ title: 'Revenue Growth', metric: 'YoY %', target: '30', unit: '%' }, { title: 'Employee NPS', metric: 'Score', target: '50', unit: 'points' }],
    },
  });

  const hrHeadRole = await prisma.role.create({
    data: {
      organization_id: org.id, department_id: hrDept.id, title: 'HR Manager',
      level: RoleLevel.head, job_description: 'Leads all people operations, hiring, and culture initiatives.',
      kra: [{ title: 'Hiring', description: 'Fill all open roles within 45 days' }, { title: 'Retention', description: 'Maintain <10% attrition rate' }],
      kpi: [{ title: 'Time-to-Fill', metric: 'Days', target: '45', unit: 'days' }, { title: 'Attrition Rate', metric: '%', target: '10', unit: '%' }],
    },
  });

  const salesRole = await prisma.role.create({
    data: {
      organization_id: org.id, department_id: salesDept.id, title: 'Sales Manager',
      level: RoleLevel.senior, job_description: 'Manages sales team and drives revenue targets.',
      kra: [{ title: 'Revenue', description: 'Hit monthly revenue targets' }, { title: 'Pipeline', description: 'Maintain 3x pipeline coverage' }],
      kpi: [{ title: 'Monthly Revenue', metric: 'INR', target: '1000000', unit: 'INR' }, { title: 'Pipeline Coverage', metric: 'X', target: '3', unit: 'x' }],
    },
  });

  const productRole = await prisma.role.create({
    data: {
      organization_id: org.id, department_id: productDept.id, title: 'Product Manager',
      level: RoleLevel.mid, job_description: 'Owns product roadmap, prioritization, and delivery.',
      kra: [{ title: 'Feature Delivery', description: 'Deliver planned features on schedule' }, { title: 'User Satisfaction', description: 'Maintain CSAT > 4.0' }],
      kpi: [{ title: 'On-time Delivery', metric: '%', target: '85', unit: '%' }, { title: 'CSAT Score', metric: 'Rating', target: '4.0', unit: '/5' }],
    },
  });

  const devRole = await prisma.role.create({
    data: {
      organization_id: org.id, department_id: techDept.id, title: 'Senior Software Engineer',
      level: RoleLevel.senior, job_description: 'Designs, builds and maintains scalable software systems.',
      kra: [{ title: 'Code Quality', description: 'Maintain < 5% bug escape rate' }, { title: 'Delivery', description: 'Complete sprint commitments with 90%+ velocity' }],
      kpi: [{ title: 'Bug Escape Rate', metric: '%', target: '5', unit: '%' }, { title: 'Sprint Velocity', metric: '%', target: '90', unit: '%' }],
    },
  });
  console.log('✅ Roles created');

  // Employees
  const ceoUser = await prisma.user.create({
    data: { name: 'Vikram Singh', email: 'ceo@acme.com', password_hash: await bcrypt.hash('Admin@123', 12), role: UserRole.employee, organization_id: org.id },
  });
  await prisma.employeeProfile.create({
    data: { organization_id: org.id, user_id: ceoUser.id, role_id: ceoRole.id, department_id: ceoOffice.id, employee_code: 'EMP001', employment_type: EmploymentType.full_time, date_of_joining: new Date('2020-01-01') },
  });

  const hrUser = await prisma.user.create({
    data: { name: 'Priya Sharma', email: 'priya@acme.com', password_hash: await bcrypt.hash('Admin@123', 12), role: UserRole.employee, organization_id: org.id },
  });
  await prisma.employeeProfile.create({
    data: { organization_id: org.id, user_id: hrUser.id, role_id: hrHeadRole.id, department_id: hrDept.id, reporting_to_user_id: ceoUser.id, employee_code: 'EMP002', employment_type: EmploymentType.full_time, date_of_joining: new Date('2020-03-15') },
  });

  const salesUser = await prisma.user.create({
    data: { name: 'Arjun Nair', email: 'arjun@acme.com', password_hash: await bcrypt.hash('Admin@123', 12), role: UserRole.employee, organization_id: org.id },
  });
  await prisma.employeeProfile.create({
    data: { organization_id: org.id, user_id: salesUser.id, role_id: salesRole.id, department_id: salesDept.id, reporting_to_user_id: ceoUser.id, employee_code: 'EMP003', employment_type: EmploymentType.full_time, date_of_joining: new Date('2021-06-01') },
  });

  const pmUser = await prisma.user.create({
    data: { name: 'Meera Iyer', email: 'meera@acme.com', password_hash: await bcrypt.hash('Admin@123', 12), role: UserRole.employee, organization_id: org.id },
  });
  await prisma.employeeProfile.create({
    data: { organization_id: org.id, user_id: pmUser.id, role_id: productRole.id, department_id: productDept.id, reporting_to_user_id: ceoUser.id, employee_code: 'EMP004', employment_type: EmploymentType.full_time, date_of_joining: new Date('2021-09-10') },
  });

  const devUser = await prisma.user.create({
    data: { name: 'Rahul Dev', email: 'rahul@acme.com', password_hash: await bcrypt.hash('Admin@123', 12), role: UserRole.employee, organization_id: org.id },
  });
  await prisma.employeeProfile.create({
    data: { organization_id: org.id, user_id: devUser.id, role_id: devRole.id, department_id: techDept.id, reporting_to_user_id: ceoUser.id, employee_code: 'EMP005', employment_type: EmploymentType.full_time, date_of_joining: new Date('2022-02-14') },
  });

  // Update dept heads
  await prisma.department.update({ where: { id: ceoOffice.id }, data: { head_user_id: ceoUser.id } });
  await prisma.department.update({ where: { id: hrDept.id }, data: { head_user_id: hrUser.id } });
  await prisma.department.update({ where: { id: salesDept.id }, data: { head_user_id: salesUser.id } });
  await prisma.department.update({ where: { id: productDept.id }, data: { head_user_id: pmUser.id } });
  await prisma.department.update({ where: { id: techDept.id }, data: { head_user_id: devUser.id } });

  console.log('✅ Employees created');
  console.log('\n🎉 Seed complete!');
  console.log('\nLogin credentials:');
  console.log('  Super Admin: superadmin@orgos.io / Admin@123');
  console.log('  Org Admin:   admin@acme.com / Admin@123');
  console.log('  HR Manager:  hr@acme.com / Admin@123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
