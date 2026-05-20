import { Injectable } from '@nestjs/common'

export interface TriggerHandler {
  readonly type: string
  validate(config: unknown): boolean
  fire(workflowTemplateId: string, config: unknown, context: unknown): Promise<void>
}

// EXTENSION POINT — to add a new trigger type:
// 1. Create a class implementing TriggerHandler
// 2. In your module's onModuleInit(), inject TriggerRegistryService and call registry.register(new YourHandler(...))
// 3. WorkflowEngineService and all existing code remain unchanged.
// Trigger config is stored as JSONB — no DB migration needed for new trigger types.
@Injectable()
export class TriggerRegistryService {
  private readonly handlers = new Map<string, TriggerHandler>()

  register(handler: TriggerHandler): void {
    this.handlers.set(handler.type, handler)
  }

  getHandler(type: string): TriggerHandler | undefined {
    return this.handlers.get(type)
  }

  listTypes(): string[] {
    return Array.from(this.handlers.keys())
  }

  isValid(type: string): boolean {
    return this.handlers.has(type)
  }
}
