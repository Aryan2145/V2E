import { TriggerHandler } from '../trigger-registry.service'

export class TaskOverdueTriggerHandler implements TriggerHandler {
  readonly type = 'task_overdue_trigger'

  validate(config: unknown): boolean {
    const c = config as { task_id?: string; category_id?: string }
    return !!(c?.task_id || c?.category_id)
  }

  async fire(_workflowTemplateId: string, _config: unknown, _context: unknown): Promise<void> {
    // Fired by the overdue cron when a matching task goes overdue
  }
}
