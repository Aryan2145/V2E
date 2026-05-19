import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password_hash },
    });

    if (dto.organization_id && dto.role) {
      await this.prisma.organizationMember.create({
        data: { organization_id: dto.organization_id, user_id: user.id, role: dto.role as any },
      });
    }

    return this.issueFullTokens(user.id, user.email, dto.organization_id ?? null, (dto.role as any) ?? null, false);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.is_super_admin) {
      const tokens = await this.issueFullTokens(user.id, user.email, null, null, true);
      return { ...tokens, user: this.buildUserPayload(user, null, null, true) };
    }

    const memberships = await this.prisma.organizationMember.findMany({
      where: { user_id: user.id, is_active: true },
      include: { organization: { select: { id: true, name: true, slug: true, logo_url: true } } },
      orderBy: { joined_at: 'asc' },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException('No active organization membership');
    }

    if (memberships.length === 1) {
      const m = memberships[0];
      const tokens = await this.issueFullTokens(user.id, user.email, m.organization_id, m.role, false);
      return { ...tokens, user: this.buildUserPayload(user, m.organization_id, m.role, false) };
    }

    const selectionToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'org_selection' },
      { secret: this.configService.get<string>('JWT_SECRET')!, expiresIn: '10m' },
    );

    return {
      requires_org_selection: true,
      selection_token: selectionToken,
      user: { id: user.id, name: user.name, email: user.email },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logo_url: m.organization.logo_url,
        role: m.role,
        joined_at: m.joined_at,
      })),
    };
  }

  async switchOrg(userId: string, dto: SwitchOrgDto) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { user_id: userId, organization_id: dto.organizationId, is_active: true },
    });
    if (!member) throw new ForbiddenException('Not a member of this organization');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.is_active) throw new UnauthorizedException();

    const tokens = await this.issueFullTokens(user.id, user.email, dto.organizationId, member.role, false);
    return { ...tokens, user: this.buildUserPayload(user, dto.organizationId, member.role, false) };
  }

  async getMyOrgs(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { user_id: userId, is_active: true },
      include: {
        organization: { select: { id: true, name: true, slug: true, logo_url: true, industry: true } },
      },
      orderBy: { joined_at: 'asc' },
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.is_active || user.refresh_token !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const tokens = await this.issueFullTokens(
        user.id,
        user.email,
        payload.organizationId ?? null,
        payload.role ?? null,
        user.is_super_admin,
      );
      return {
        ...tokens,
        user: this.buildUserPayload(user, payload.organizationId ?? null, payload.role ?? null, user.is_super_admin),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refresh_token: null } });
    return { message: 'Logged out successfully' };
  }

  private async issueFullTokens(
    userId: string,
    email: string,
    organizationId: string | null,
    role: string | null,
    isSuperAdmin: boolean,
  ) {
    const payload: Record<string, any> = { sub: userId, email, isSuperAdmin };
    if (organizationId) payload.organizationId = organizationId;
    if (role) payload.role = role;

    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET')!,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as any,
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET')!,
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') as any,
    });

    await this.prisma.user.update({ where: { id: userId }, data: { refresh_token } });

    return { access_token, refresh_token };
  }

  private buildUserPayload(
    user: { id: string; name: string; email: string },
    organizationId: string | null,
    role: string | null,
    isSuperAdmin: boolean,
  ) {
    return { id: user.id, name: user.name, email: user.email, isSuperAdmin, organizationId, role };
  }
}
