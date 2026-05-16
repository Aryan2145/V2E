import { Module } from '@nestjs/common';
import { OrgIdentityController } from './org-identity.controller';
import { OrgIdentityService } from './org-identity.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrgIdentityController],
  providers: [OrgIdentityService],
  exports: [OrgIdentityService],
})
export class OrgIdentityModule {}
