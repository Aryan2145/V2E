import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { DocumentConversionService } from './document-conversion.service';

/** Global so any feature module can inject R2Service / DocumentConversionService without re-importing. */
@Global()
@Module({
  providers: [R2Service, DocumentConversionService],
  exports: [R2Service, DocumentConversionService],
})
export class StorageModule {}
