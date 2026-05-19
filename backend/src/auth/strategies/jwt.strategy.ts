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
      include: { employee_profile: { select: { id: true } } },
    });
    if (!user || !user.is_active) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.is_super_admin,
      organizationId: payload.organizationId ?? null,
      role: payload.role ?? null,
      employee_profile_id: user.employee_profile?.id ?? null,
    };
  }
}
