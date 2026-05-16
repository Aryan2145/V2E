import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertOrgIdentityDto } from './dto/upsert-org-identity.dto';

@Injectable()
export class OrgIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrg(orgId: string) {
    const existing = await this.prisma.orgIdentity.findUnique({
      where: { organization_id: orgId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.orgIdentity.create({
      data: { organization_id: orgId },
    });
  }

  async upsert(orgId: string, dto: UpsertOrgIdentityDto) {
    return this.prisma.orgIdentity.upsert({
      where: { organization_id: orgId },
      create: {
        organization_id: orgId,
        ...dto,
        values: (dto.values ?? []) as any,
      } as any,
      update: {
        ...dto,
        values: (dto.values ?? []) as any,
      } as any,
    });
  }
}
