import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';

/** Global so any feature module can inject R2Service without re-importing. */
@Global()
@Module({
  providers: [R2Service],
  exports: [R2Service],
})
export class StorageModule {}
