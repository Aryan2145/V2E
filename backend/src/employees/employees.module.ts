import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeImportService } from './employee-import.service';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [PrismaModule, forwardRef(() => LearningModule)],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeImportService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
