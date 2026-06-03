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

    // A user can now have one profile PER organization — resolve the profile for
    // the org this token is scoped to, and that org's test flag, in one query.
    let isTestOrg = false;
    let employeeProfileId: string | null = null;
    if (organizationId) {
      const [org, profile] = await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { is_test: true },
        }),
        this.prisma.employeeProfile.findFirst({
          where: { user_id: user.id, organization_id: organizationId },
          select: { id: true },
        }),
      ]);
      isTestOrg = org?.is_test ?? false;
      employeeProfileId = profile?.id ?? null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.is_super_admin,
      organizationId,
      role: payload.role ?? null,
      isTestOrg,
      employee_profile_id: employeeProfileId,
    };
  }
}
