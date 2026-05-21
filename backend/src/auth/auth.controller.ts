import { Controller, Post, Body, UseGuards, Get, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperAdmin } from '../common/decorators/super-admin.decorator';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('admin-login')
  adminLogin(@Body() dto: LoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: any) {
    return { data: user };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('switch-org')
  switchOrg(@CurrentUser('id') userId: string, @Body() dto: SwitchOrgDto) {
    return this.authService.switchOrg(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my-orgs')
  myOrgs(@CurrentUser('id') userId: string) {
    return this.authService.getMyOrgs(userId);
  }

  // ─── Admin user management (super admin only) ─────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @SuperAdmin()
  @ApiBearerAuth()
  @Get('admins')
  listAdmins() {
    return this.authService.listAdmins();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @SuperAdmin()
  @ApiBearerAuth()
  @Post('admins')
  createAdmin(@Body() dto: { name: string; email: string; password: string }) {
    return this.authService.createAdmin(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @SuperAdmin()
  @ApiBearerAuth()
  @Patch('admins/:id/toggle')
  toggleAdmin(
    @Param('id') id: string,
    @CurrentUser('id') requesterId: string,
    @Body() dto: { is_active: boolean },
  ) {
    return this.authService.toggleAdmin(id, requesterId, dto.is_active);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @SuperAdmin()
  @ApiBearerAuth()
  @Delete('admins/:id')
  revokeAdmin(@Param('id') id: string, @CurrentUser('id') requesterId: string) {
    return this.authService.revokeAdmin(id, requesterId);
  }
}
