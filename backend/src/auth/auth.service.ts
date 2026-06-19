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

    if (dto.organization_id) {
      await this.prisma.organizationMember.create({
        data: { organization_id: dto.organization_id, user_id: user.id, is_admin: dto.is_admin ?? false },
      });
    }

    return this.issueFullTokens(user.id, user.email, dto.organization_id ?? null, false);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

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
      const tokens = await this.issueFullTokens(user.id, user.email, m.organization_id, false);
      return { ...tokens, user: await this.buildUserPayload(user, m.organization_id, m.is_admin, false) };
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
        is_admin: m.is_admin,
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

    const tokens = await this.issueFullTokens(user.id, user.email, dto.organizationId, false);
    return { ...tokens, user: await this.buildUserPayload(user, dto.organizationId, member.is_admin, false) };
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
      const organizationId = payload.organizationId ?? null;
      let isAdmin = false;
      if (organizationId) {
        const member = await this.prisma.organizationMember.findFirst({
          where: { user_id: user.id, organization_id: organizationId, is_active: true },
          select: { is_admin: true },
        });
        isAdmin = member?.is_admin ?? false;
      }
      const tokens = await this.issueFullTokens(user.id, user.email, organizationId, user.is_super_admin);
      return {
        ...tokens,
        user: await this.buildUserPayload(user, organizationId, isAdmin, user.is_super_admin),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async adminLogin(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.is_super_admin) throw new UnauthorizedException('Access denied. Super administrator credentials required.');

    const tokens = await this.issueFullTokens(user.id, user.email, null, true);
    return { ...tokens, user: await this.buildUserPayload(user, null, false, true) };
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refresh_token: null } });
    return { message: 'Logged out successfully' };
  }

  async listAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { is_super_admin: true },
      select: { id: true, name: true, email: true, is_active: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });
    return admins;
  }

  async createAdmin(dto: { name: string; email: string; password: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      if (existing.is_super_admin) throw new ConflictException('This email is already a super administrator.');
      // Promote existing user to super admin
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { is_super_admin: true },
        select: { id: true, name: true, email: true, is_active: true, created_at: true },
      });
    }
    const password_hash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password_hash, is_super_admin: true },
      select: { id: true, name: true, email: true, is_active: true, created_at: true },
    });
  }

  async toggleAdmin(targetId: string, requesterId: string, is_active: boolean) {
    if (targetId === requesterId) throw new ForbiddenException('You cannot deactivate your own account.');
    return this.prisma.user.update({
      where: { id: targetId, is_super_admin: true },
      data: { is_active },
      select: { id: true, name: true, email: true, is_active: true, created_at: true },
    });
  }

  async revokeAdmin(targetId: string, requesterId: string) {
    if (targetId === requesterId) throw new ForbiddenException('You cannot revoke your own super admin access.');
    return this.prisma.user.update({
      where: { id: targetId, is_super_admin: true },
      data: { is_super_admin: false },
      select: { id: true, name: true, email: true, is_active: true, created_at: true },
    });
  }

  private async issueFullTokens(
    userId: string,
    email: string,
    organizationId: string | null,
    isSuperAdmin: boolean,
  ) {
    const payload: Record<string, any> = { sub: userId, email, isSuperAdmin };
    if (organizationId) payload.organizationId = organizationId;

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

  private async buildUserPayload(
    user: { id: string; name: string; email: string },
    organizationId: string | null,
    isAdmin: boolean,
    isSuperAdmin: boolean,
  ) {
    let isTestOrg = false;
    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { is_test: true },
      });
      isTestOrg = org?.is_test ?? false;
    }
    return { id: user.id, name: user.name, email: user.email, isSuperAdmin, organizationId, is_admin: isAdmin, isTestOrg };
  }
}
