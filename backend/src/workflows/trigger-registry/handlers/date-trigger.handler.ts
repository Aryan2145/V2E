import { TriggerHandler } from '../trigger-registry.service'

export interface DateTriggerConfig {
  date?: string  // ISO date string for one-shot; omit for cron-based recurring
  cron?: string  // cron expression for recurring date triggers
}

export class DateTriggerHandler implements TriggerHandler {
  readonly type = 'date_trigger'

  validate(config: unknown): boolean {
    const c = config as DateTriggerConfig
    return !!(c?.date || c?.cron)
  }

  async fire(_workflowTemplateId: string, _config: unknown, _context: unknown): Promise<void> {
    // Fired by WorkflowEngineService.processDateTriggers() cron — not called directly
  }
}
