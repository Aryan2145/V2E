import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { AuditContextService } from './audit-context.service';
import { AuditContextInterceptor } from './audit-context.interceptor';

/**
 * Establishes the per-request CLS context (via nestjs-cls middleware) and the
 * global interceptor that seeds actor/org/trigger into it and flushes the audit
 * buffer after each response. Global so AuditContextService is injectable
 * everywhere — notably the Prisma capture extension.
 */
@Global()
@Module({
  imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } })],
  providers: [
    AuditContextService,
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
  ],
  exports: [AuditContextService],
})
export class AuditClsModule {}
