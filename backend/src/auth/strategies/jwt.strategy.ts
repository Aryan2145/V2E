import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.is_active) throw new UnauthorizedException();

    const organizationId = payload.organizationId ?? null;

    // A user can now have one profile PER organization — resolve, for the org this
    // token is scoped to: the org's test flag, the employee profile (+ its job role),
    // and the membership's admin flag. Job role + is_admin drive the four-layer model.
    let isTestOrg = false;
    let employeeProfileId: string | null = null;
    let jobRoleId: string | null = null;
    let isAdmin = false;
    if (organizationId) {
      const [org, profile, member] = await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { is_test: true },
        }),
        this.prisma.employeeProfile.findFirst({
          where: { user_id: user.id, organization_id: organizationId },
          select: { id: true, role_id: true },
        }),
        this.prisma.organizationMember.findUnique({
          where: { organization_id_user_id: { organization_id: organizationId, user_id: user.id } },
          select: { is_admin: true },
        }),
      ]);
      isTestOrg = org?.is_test ?? false;
      employeeProfileId = profile?.id ?? null;
      jobRoleId = profile?.role_id ?? null;
      isAdmin = member?.is_admin ?? false;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.is_super_admin,
      organizationId,
      is_admin: isAdmin,
      job_role_id: jobRoleId,
      isTestOrg,
      employee_profile_id: employeeProfileId,
    };
  }
}
