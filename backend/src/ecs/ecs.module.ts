import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyPoliciesController } from './company-policies.controller';
import { CompanyPoliciesService } from './company-policies.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyPoliciesController],
  providers: [CompanyPoliciesService],
})
export class EcsModule {}
