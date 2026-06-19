import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectEligibilityService, EligibleSubjectItem } from './subject-eligibility.service';
import { axisOf, isValidLeaf } from './permission-registry';

/**
 * One shared candidate-list endpoint that every picker consumes, so ineligible
 * targets are greyed-out uniformly with a reason. Returns ALL candidates annotated
 * with `eligible` + `reason` — the client disables ineligible rows, never hides the
 * fact that they're blocked (fail loud).
 */
@ApiTags('eligible-subjects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgScopeGuard)
@Controller('api/v1/org/:orgId/eligible-subjects')
export class EligibleSubjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subjects: SubjectEligibilityService,
  ) {}

  @Get(':subjectKey')
  @ApiOperation({ summary: 'List org members annotated with subject eligibility for a picker' })
  async list(
    @Param('orgId') orgId: string,
    @Param('subjectKey') subjectKey: string,
    @Query('search') search?: string,
    @Query('candidateIds') candidateIds?: string,
  ): Promise<{ items: EligibleSubjectItem[] }> {
    if (!isValidLeaf(subjectKey) || axisOf(subjectKey) !== 'subject') {
      throw new BadRequestException(`Unknown subject permission "${subjectKey}"`);
    }

    const ids = candidateIds
      ? candidateIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const profiles = await this.prisma.employeeProfile.findMany({
      where: {
        organization_id: orgId,
        status: 'active',
        ...(ids ? { user_id: { in: ids } } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } }, department: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    });

    const candidates: EligibleSubjectItem[] = profiles.map((p) => ({
      userId: p.user_id,
      name: p.user?.name ?? p.user?.email ?? 'Unknown',
      email: p.user?.email,
      department: p.department?.name ?? null,
      eligible: true,
    }));

    const items = await this.subjects.annotate(orgId, subjectKey, candidates);
    return { items };
  }
}
