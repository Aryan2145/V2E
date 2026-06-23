import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ClockService } from '../../clock/clock.service';
import { AuditContextService } from './audit-context.service';
import { AuditWriterService } from '../../audit/audit-writer.service';

/**
 * Seeds the per-request audit CLS context once the JWT guard has resolved
 * `request.user`, then — after the response is produced — drains any buffered
 * audit entries and flushes them out of the request path. Registered globally
 * (APP_INTERCEPTOR) so every authenticated mutation is covered automatically.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(
    private readonly ctx: AuditContextService,
    private readonly clock: ClockService,
    private readonly writer: AuditWriterService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; organizationId?: string } | undefined;
    const orgId: string | undefined = user?.organizationId ?? req.params?.orgId;

    if (this.ctx.isActive) {
      this.ctx.orgId = orgId ?? null;
      this.ctx.actorId = user?.id ?? null;
      this.ctx.actorType = 'user';
      this.ctx.requestId = (req.headers?.['x-request-id'] as string) ?? randomUUID();
      this.ctx.ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
      this.ctx.userAgent = (req.headers?.['user-agent'] as string) ?? null;
      // Business time — respects the per-org simulated clock for test orgs.
      this.ctx.occurredAt = await this.clock.now(orgId);
    }

    return next.handle().pipe(
      finalize(() => {
        // Still inside the CLS context here — capture entries before they're lost.
        this.writer.flushAfterResponse();
      }),
    );
  }
}
