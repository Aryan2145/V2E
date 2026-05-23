import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectTemplatesController } from './project-templates.controller';
import { ProjectsService } from './projects.service';
import { ProjectTemplatesService } from './project-templates.service';
import { ProjectProgressService } from './project-progress.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, ProjectTemplatesController],
  providers: [ProjectsService, ProjectTemplatesService, ProjectProgressService],
  exports: [ProjectProgressService],
})
export class ProjectsModule {}
