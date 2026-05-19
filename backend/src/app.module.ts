import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { OrgIdentityModule } from './org-identity/org-identity.module';
import { CultureModule } from './culture/culture.module';
import { DepartmentsModule } from './departments/departments.module';
import { RolesModule } from './roles/roles.module';
import { EmployeesModule } from './employees/employees.module';
import { LearningModule } from './learning/learning.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { BulletinModule } from './bulletin/bulletin.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MessagingModule } from './messaging/messaging.module';
import { GroupsModule } from './groups/groups.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskMastersModule } from './task-masters/task-masters.module';
import { RecurringTasksModule } from './recurring-tasks/recurring-tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    GroupsModule,
    OrganizationsModule,
    UsersModule,
    OrgIdentityModule,
    CultureModule,
    DepartmentsModule,
    RolesModule,
    EmployeesModule,
    LearningModule,
    AnnouncementsModule,
    BulletinModule,
    KnowledgeModule,
    MessagingModule,
    TasksModule,
    TaskMastersModule,
    RecurringTasksModule,
  ],
})
export class AppModule {}
