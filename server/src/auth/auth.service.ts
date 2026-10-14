import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  INVALID_CREDENTIALS_MESSAGE,
} from './auth.constants.js';
import { AttemptLimiterService } from './attempt-limiter.service.js';
import { PasswordService } from './password.service.js';
import {
  IssuedRefreshToken,
  RefreshTokenService,
} from './refresh-token.service.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  sid: string;
}

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface Session {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SessionUser;
  refreshToken: IssuedRefreshToken;
}

const SESSION_USER_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly limiter: AttemptLimiterService,
  ) {}

  async login(email: string, password: string, ip: string): Promise<Session> {
    await this.limiter.assertAllowed('login', [ip, email]);

    const account = await this.prisma.user.findUnique({
      where: { email },
      select: { ...SESSION_USER_FIELDS, passwordHash: true, deletedAt: true },
    });
    const isActive = account !== null && account.deletedAt === null;
    const passwordMatches = await this.passwords.verify(
      isActive ? account.passwordHash : null,
      password,
    );

    if (!isActive || !passwordMatches) {
      await this.limiter.record('login', [ip, email]);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.limiter.reset('login', [ip, email]);

    const {
      passwordHash: _passwordHash,
      deletedAt: _deletedAt,
      ...user
    } = account;

    return this.openSession(user, await this.refreshTokens.issue(user.id));
  }

  async refresh(refreshToken: string | undefined): Promise<Session> {
    const rotation = refreshToken
      ? await this.refreshTokens.rotate(refreshToken)
      : { status: 'rejected' as const };

    if (rotation.status === 'rejected') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: rotation.userId },
      select: SESSION_USER_FIELDS,
    });

    return this.openSession(user, rotation.refreshToken);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.refreshTokens.revoke(refreshToken);
    }
  }

  private async openSession(
    user: SessionUser,
    refreshToken: IssuedRefreshToken,
  ): Promise<Session> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      sid: refreshToken.familyId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user,
      refreshToken,
    };
  }
}
