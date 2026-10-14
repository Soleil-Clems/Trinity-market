import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Env } from '../config/env.js';
import { MailModule } from '../mail/mail.module.js';
import { AttemptLimiterService } from './attempt-limiter.service.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { MePasswordController } from './me-password.controller.js';
import { PasswordManagementService } from './password-management.service.js';
import { PasswordTokenService } from './password-token.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController, MePasswordController],
  providers: [
    AuthService,
    AttemptLimiterService,
    PasswordManagementService,
    PasswordService,
    PasswordTokenService,
    RefreshTokenService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PasswordService, PasswordManagementService],
})
export class AuthModule {}
