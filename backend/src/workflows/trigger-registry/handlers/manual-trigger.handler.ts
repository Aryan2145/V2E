import { TriggerHandler } from '../trigger-registry.service'

export class ManualTriggerHandler implements TriggerHandler {
  readonly type = 'manual_trigger'

  validate(_config: unknown): boolean {
    return true
  }

  async fire(_workflowTemplateId: string, _config: unknown, _context: unknown): Promise<void> {
    // Manual triggers are fired via the API endpoint directly — no polling needed
  }
}
