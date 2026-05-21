import { Module, OnModuleInit } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { HolidaysModule } from '../holidays/holidays.module'
import { TriggerRegistryService } from './trigger-registry/trigger-registry.service'
import { ManualTriggerHandler } from './trigger-registry/handlers/manual-trigger.handler'
import { DateTriggerHandler } from './trigger-registry/handlers/date-trigger.handler'
import { TaskCompletedTriggerHandler } from './trigger-registry/handlers/task-completed-trigger.handler'
import { TaskOverdueTriggerHandler } from './trigger-registry/handlers/task-overdue-trigger.handler'
import { WorkflowTemplateService } from './workflow-template.service'
import { WorkflowTemplateController } from './workflow-template.controller'
import { WorkflowEngineService } from './workflow-engine.service'

@Module({
  imports: [PrismaModule, HolidaysModule],
  controllers: [WorkflowTemplateController],
  providers: [TriggerRegistryService, WorkflowTemplateService, WorkflowEngineService],
  exports: [WorkflowEngineService, TriggerRegistryService],
})
export class WorkflowsModule implements OnModuleInit {
  constructor(private readonly triggerRegistry: TriggerRegistryService) {}

  onModuleInit() {
    this.triggerRegistry.register(new ManualTriggerHandler())
    this.triggerRegistry.register(new DateTriggerHandler())
    this.triggerRegistry.register(new TaskCompletedTriggerHandler())
    this.triggerRegistry.register(new TaskOverdueTriggerHandler())
  }
}
