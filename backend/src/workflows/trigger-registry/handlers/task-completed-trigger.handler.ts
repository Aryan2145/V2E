import { TriggerHandler } from '../trigger-registry.service'

export class TaskCompletedTriggerHandler implements TriggerHandler {
  readonly type = 'task_completed_trigger'

  validate(config: unknown): boolean {
    const c = config as { task_id?: string; category_id?: string }
    return !!(c?.task_id || c?.category_id)
  }

  async fire(_workflowTemplateId: string, _config: unknown, _context: unknown): Promise<void> {
    // Fired by TasksService when a matching task completes
  }
}
