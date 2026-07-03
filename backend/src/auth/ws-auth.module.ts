import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsAuthService } from './ws-auth.service';

/**
 * Provides {@link WsAuthService} to any gateway that needs to authenticate its
 * handshake. Registers its own JwtModule (verify-only) so it doesn't depend on
 * AuthModule internals; PrismaService is global. Import this in any module that
 * declares a WebSocketGateway.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET')!,
      }),
    }),
  ],
  providers: [WsAuthService],
  exports: [WsAuthService],
})
export class WsAuthModule {}
